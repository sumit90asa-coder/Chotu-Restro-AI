"""Phase 5: Floor and Table Management Schema Enhancement

Revision ID: 004_floor_and_table_management
Revises: 003_phase4_admin_and_operations
Create Date: 2026-11-25 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_floor_and_table_management'
down_revision: Union[str, None] = '003_phase4_admin_and_operations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Safely add floor_name column to dining_tables if not exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('dining_tables')]
    
    if 'floor_name' not in columns:
        op.add_column(
            'dining_tables',
            sa.Column('floor_name', sa.String(100), server_default='Main AC Hall', nullable=False)
        )

def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('dining_tables')]
    if 'floor_name' in columns:
        op.drop_column('dining_tables', 'floor_name')
