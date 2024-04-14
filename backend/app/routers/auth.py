from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from .. import models
import httpx
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone    
from ..config import *
from ..utils import *

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    print(user)
    user_created = False
    if not user:
        user_created = True
        hashed_password = pwd_context.hash(form_data.password)
        new_user = models.User(email=form_data.username, username=extract_username(form_data.username), password=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user = new_user
    elif user.password is None:
        raise HTTPException(status_code=400, detail="Try to login with Google")
    elif not pwd_context.verify(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "created": user_created}

@router.post("/auth/google")
async def google_authenticate(access_token: str = Body(..., embed=True), db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'})
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Google auth failed")
    google_user_info = response.json()
    user = db.query(models.User).filter(models.User.email == google_user_info["email"]).first()
    if not user:
        user = models.User(
            email=google_user_info["email"],
            username=google_user_info["name"],
            picture=google_user_info["picture"],
        )
        db.add(user)
    else:
        user.picture = google_user_info["picture"]
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
    
@router.get("/users/me")
async def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))