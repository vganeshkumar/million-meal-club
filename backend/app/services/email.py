"""Donor-onboarding email, sent when the founder approves a donor
application. Same local/dynamodb-keyed split as every other service — see
specs/features/007-donor-application-approval/design.md."""

import os
from typing import Protocol


class EmailSender(Protocol):
    def send_donor_onboarded(self, to_email: str, name: str) -> None: ...
    def send_volunteer_onboarded(self, to_email: str, name: str) -> None: ...


class LocalEmailSender:
    def send_donor_onboarded(self, to_email: str, name: str) -> None:
        print(f"[email] would send onboarding email to {to_email} ({name})")

    def send_volunteer_onboarded(self, to_email: str, name: str) -> None:
        print(f"[email] would send onboarding email to {to_email} ({name})")


class SesEmailSender:
    def __init__(self) -> None:
        import boto3

        self._client = boto3.client("ses")
        self._from_email = os.environ["SES_FROM_EMAIL"]
        self._charity_name = os.environ.get("CHARITY_NAME", "The Million Meal Club")

    def send_donor_onboarded(self, to_email: str, name: str) -> None:
        subject = f"You're onboarded as a donor at {self._charity_name}!"
        body = (
            f"Hi {name},\n\n"
            f"Your donor application has been approved — welcome to "
            f"{self._charity_name}. You can now sign in on the site with "
            f"the same Google account and start submitting "
            f"proof of your deliveries.\n\n"
            f"Thank you for joining us.\n"
        )
        self._client.send_email(
            Source=self._from_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": body}},
            },
        )

    def send_volunteer_onboarded(self, to_email: str, name: str) -> None:
        subject = f"You're approved as a volunteer at {self._charity_name}!"
        body = (
            f"Hi {name},\n\n"
            f"Your volunteer application has been approved — welcome to "
            f"{self._charity_name}. You can now sign in on the site with "
            f"the same Google account to RSVP to events and "
            f"submit proof of delivery on a donor's behalf.\n\n"
            f"Thank you for joining us.\n"
        )
        self._client.send_email(
            Source=self._from_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": body}},
            },
        )


_email_sender: EmailSender | None = None


def get_email_sender() -> EmailSender:
    global _email_sender
    if _email_sender is not None:
        return _email_sender

    backend = os.environ.get("DATA_BACKEND", "local")
    _email_sender = SesEmailSender() if backend == "dynamodb" else LocalEmailSender()
    return _email_sender
