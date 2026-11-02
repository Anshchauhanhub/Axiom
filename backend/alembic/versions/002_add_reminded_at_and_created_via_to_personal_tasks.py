"""add reminded_at and created_via to personal_tasks

Revision ID: 002_add_reminded_at_and_created_via
Revises: 001_add_requires_quiz_to_parts
Create Date: 2026-11-01 10:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_reminded_at_and_created_via'
down_revision = '001_add_requires_quiz_to_parts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('personal_tasks', sa.Column('reminded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('personal_tasks', sa.Column('created_via', sa.String(), server_default='web', nullable=True))
    op.create_index('ix_personal_tasks_user_id', 'personal_tasks', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_personal_tasks_user_id', table_name='personal_tasks')
    op.drop_column('personal_tasks', 'created_via')
    op.drop_column('personal_tasks', 'reminded_at')
