FROM public.ecr.aws/lambda/python:3.13

COPY pyproject.toml ${LAMBDA_TASK_ROOT}/pyproject.toml
RUN pip install --no-cache-dir \
    fastapi mangum boto3 pydantic google-auth requests httpx pyjwt

COPY app ${LAMBDA_TASK_ROOT}/app

CMD ["app.main.handler"]
