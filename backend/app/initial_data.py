from sqlalchemy.orm import Session

def init_demo_db(db: Session):
    """
    Demo auto-seeding is permanently disabled to ensure clean tenant onboarding.
    All restaurants, owners, and accounts are registered through /api/v1/auth/register.
    """
    return
