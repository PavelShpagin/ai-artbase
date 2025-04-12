"""add_descriptive_prompt_column

Revision ID: 8659b4478ce1
Revises: 139f4003233c
Create Date: 2025-04-04 16:04:57.643712

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8659b4478ce1'
down_revision: Union[str, None] = '139f4003233c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
