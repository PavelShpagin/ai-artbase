import boto3
from fastapi import UploadFile
from .config import R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET_NAME, R2_PUBLIC_URL

def get_r2_client():
    """Create and return a boto3 S3 client configured for Cloudflare R2"""
    return boto3.client(
        's3',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        endpoint_url=R2_ENDPOINT_URL
    )

async def upload_image_to_r2(file: UploadFile, filename: str):
    """Upload an image to Cloudflare R2 storage
    
    Args:
        file: The uploaded file
        filename: The filename to use in R2 storage
        
    Returns:
        str: The URL to access the uploaded file
    """
    client = get_r2_client()
    file.file.seek(0)  # Reset file pointer to beginning
    
    try:
        client.upload_fileobj(
            file.file, 
            R2_BUCKET_NAME, 
            filename,
            ExtraArgs={"ContentType": file.content_type}
        )
        return f"{R2_PUBLIC_URL}/{filename}"
    except Exception as e:
        # Reset file pointer for potential retry
        file.file.seek(0)
        raise e

def get_image_from_r2(filename: str):
    """Get an image URL from R2
    
    Args:
        filename: The filename in R2 storage
        
    Returns:
        str: The URL to access the file
    """
    return f"{R2_PUBLIC_URL}/{R2_BUCKET_NAME}/{filename}"

def delete_image_from_r2(filename: str):
    """Delete an image from R2 storage
    
    Args:
        filename: The filename in R2 storage
    """
    client = get_r2_client()
    client.delete_object(Bucket=R2_BUCKET_NAME, Key=filename) 