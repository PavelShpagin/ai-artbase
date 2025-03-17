from fastapi import APIRouter, Depends, Path, Body
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..utils import *

router = APIRouter()

@router.get('/users', response_model=List[schemas.User])
def read_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return users

@router.patch('/users/', response_model=schemas.User)
def update_role(user_id: int = Body(..., embed=True), role: str = Body(..., embed=True), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user.role = role
    db.commit()
    db.refresh(user)
    return user
