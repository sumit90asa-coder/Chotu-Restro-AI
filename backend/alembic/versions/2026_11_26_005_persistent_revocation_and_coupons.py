"""Phase 6: Persistent Token Revocation and Server-Side Coupons

Revision ID: 005_persistent_revocation_and_coupons
Revises: 004_floor_and_table_management
Create Date: 2026-11-26 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_persistent_revocation'
down_revision: Union[str, None] = '004_floor_and_table_management'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create revoked_tokens table if not exists
    if 'revoked_tokens' not in tables:
        op.create_table(
            'revoked_tokens',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('token', sa.Text(), nullable=False),
            sa.Column('user_id', sa.String(50), nullable=True),
            sa.Column('revoked_at', sa.DateTime(), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
        )
        op.create_index('idx_revoked_tokens_expires_at', 'revoked_tokens', ['expires_at'])
        op.create_index('ix_revoked_tokens_id', 'revoked_tokens', ['id'])
        op.create_index('ix_revoked_tokens_user_id', 'revoked_tokens', ['user_id'])

    # 2. Create coupons table if not exists
    if 'coupons' not in tables:
        op.create_table(
            'coupons',
            sa.Column('id', sa.String(50), primary_key=True),
            sa.Column('restaurant_id', sa.String(50), sa.ForeignKey('restaurants.id'), nullable=False),
            sa.Column('code', sa.String(50), nullable=False),
            sa.Column('description', sa.String(255), nullable=True),
            sa.Column('discount_type', sa.String(20), server_default='percentage', nullable=False),
            sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
            sa.Column('min_order_value', sa.Numeric(10, 2), server_default='0.00', nullable=False),
            sa.Column('max_discount', sa.Numeric(10, 2), nullable=True),
            sa.Column('usage_limit', sa.Integer(), server_default='1000', nullable=False),
            sa.Column('used_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )
        op.create_index('idx_coupons_rest_code', 'coupons', ['restaurant_id', 'code'])
        op.create_index('ix_coupons_code', 'coupons', ['code'])
        op.create_index('ix_coupons_restaurant_id', 'coupons', ['restaurant_id'])

    # 3. Add customer_session_token to orders if not exists
    columns = [col['name'] for col in inspector.get_columns('orders')]
    if 'customer_session_token' not in columns:
        op.add_column('orders', sa.Column('customer_session_token', sa.String(128), nullable=True))
        op.create_index('ix_orders_customer_session_token', 'orders', ['customer_session_token'])

def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    columns = [col['name'] for col in inspector.get_columns('orders')]
    if 'customer_session_token' in columns:
        op.drop_column('orders', 'customer_session_token')

    if 'coupons' in tables:
        op.drop_table('coupons')
    if 'revoked_tokens' in tables:
        op.drop_table('revoked_tokens')
