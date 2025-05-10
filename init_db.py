from server.database import engine, Base
from server.models import User, UserType  # Import all your models

def init_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database initialization completed!")

if __name__ == "__main__":
    init_db()