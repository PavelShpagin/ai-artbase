from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import models, schemas
from utils import *

router = APIRouter()

@router.get("/categories/top/", response_model=List[schemas.CategoryCount])
async def read_top_categories(db: Session = Depends(get_db)):
    categories_counts = (
        db.query(
            models.Category.name, 
            func.count(models.art_categories.c.art_id).label("count")
        )
        .join(models.art_categories, models.art_categories.c.category_id == models.Category.id)
        .group_by(models.Category.name)
        .order_by(func.count(models.art_categories.c.art_id).desc())
        .limit(10)
        .all()
    )

    categories = [category_count[0] for category_count in categories_counts]
    counts = [category_count[1] for category_count in categories_counts]

    response = [schemas.CategoryCount(name=category, count=count) for category, count in zip(categories, counts)]
    return response