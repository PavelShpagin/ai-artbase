"""add_descriptive_prompt_column

Revision ID: ba0eb816ef37
Revises: 8659b4478ce1
Create Date: 2025-04-04 16:14:59.847346

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba0eb816ef37'
down_revision: Union[str, None] = '8659b4478ce1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # op.add_column('arts', sa.Column('descriptive_prompt', sa.String(), nullable=True))
    # ### end Alembic commands ###
    pass


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # op.drop_column('arts', 'descriptive_prompt')
    # ### end Alembic commands ###
    pass
