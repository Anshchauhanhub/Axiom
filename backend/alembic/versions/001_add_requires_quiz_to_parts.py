"""add requires_quiz to parts

Revision ID: 001_add_requires_quiz_to_parts
Revises: 
Create Date: 2026-09-06 09:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_add_requires_quiz_to_parts'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('parts', sa.Column('requires_quiz', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    op.drop_column('parts', 'requires_quiz')
