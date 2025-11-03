from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from backend.models.users import User
from backend.models.customers import Customer
from backend.models.invitations import Invitation
from backend.core.security import hash_password, create_invitation_token
from backend.services.password_service import generate_secure_password
from backend.core.email import send_new_user_invitation_email, UserRole
from backend.schemas.user_schemas import UserResponse

class InvitationService:
    def __init__(self, db: Session):
        self.db = db

    async def create_invitation(
        self,
        email: str,
        role: str,
        invited_name: str,
        created_by: int,
        background_tasks: BackgroundTasks,
        customer_id: Optional[int] = None
    ) -> dict:
        """
        Creates a new user invitation with a secure temporary password.
        Also creates the user record immediately so login works.
        """

        # 1️⃣ Check if user already exists
        existing_user = self.db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        # 2️⃣ Check for existing unused invitation
        existing_invitation = self.db.query(Invitation).filter(
            Invitation.email == email,
            Invitation.used_at.is_(None),
            Invitation.expires_at > datetime.utcnow()
        ).first()
        if existing_invitation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Active invitation already exists for this email"
            )

        # 3️⃣ Handle customer creation for CUSTOMER role
        if role == UserRole.CUSTOMER.value:
            if customer_id:
                customer = self.db.query(Customer).filter(Customer.customer_id == customer_id).first()
                if not customer:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Customer with id={customer_id} does not exist"
                    )
            else:
                customer = Customer(
                    customer_details=f"Customer for {invited_name}",
                    contact_person=invited_name,
                    email=email,
                    created_at=datetime.utcnow(),
                    is_active=True
                )
                self.db.add(customer)
                self.db.flush()  # get customer_id
                customer_id = customer.customer_id
        else:
            customer_id = None

        # 4️⃣ Generate secure password and invitation token
        temp_password = generate_secure_password()
        temp_password_hash = hash_password(temp_password)
        invitation_token = create_invitation_token()

        # 5️⃣ Create user immediately
        username = email.split("@")[0]
        counter = 1
        original_username = username
        while self.db.query(User).filter(User.username == username).first():
            username = f"{original_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=email,
            full_name=invited_name,
            password_hash=temp_password_hash,
            role=role,
            customer_id=customer_id,
            is_active=True
        )
        self.db.add(user)

        # 6️⃣ Create invitation record
        invitation = Invitation(
            email=email,
            token=invitation_token,
            user_role=role,
            invited_name=invited_name,
            temp_password_hash=temp_password_hash,
            expires_at=datetime.utcnow() + timedelta(hours=48),
            created_by=created_by,
            customer_id=customer_id
        )
        self.db.add(invitation)

        self.db.commit()
        self.db.refresh(invitation)
        self.db.refresh(user)

        # 7️⃣ Send role-specific invitation email
        await send_new_user_invitation_email(
            background_tasks=background_tasks,
            email=email,
            name=invited_name,
            role=UserRole(role),
            temporary_password=temp_password,
            token=invitation_token,
            expires_hours=48
        )

        return {
            "message": "Invitation sent and user created successfully",
            "email": email,
            "role": role,
            "expires_at": invitation.expires_at
        }

    async def accept_invitation(self, token: str, new_password: str) -> UserResponse:
        """
        Accept an invitation by updating the user's password.
        The user record is already created at invitation time.
        """
        invitation = self.db.query(Invitation).filter(
            Invitation.token == token,
            Invitation.used_at.is_(None),
            Invitation.expires_at > datetime.utcnow()
        ).first()
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired invitation token"
            )

        # Update the user's password
        user = self.db.query(User).filter(User.email == invitation.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Associated user not found"
            )

        user.password_hash = hash_password(new_password)
        invitation.used_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(user)

        return UserResponse.from_orm(user)
