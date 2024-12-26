## Seeding a Database with Synthetic Employee Data

This project automates the seeding of a MongoDB database with synthetic employee data. By leveraging a Large Language Model (LLM) for data generation and MongoDB Atlas Vector Search for advanced querying, it provides a scalable and dynamic approach to populating the database. Below is an overview of the functionality:

## Overview

The seeding process involves: 1. Synthetic Data Generation:

- An LLM generates 10 fictional but realistic employee records.
- The data is structured using a predefined schema to ensure consistency and completeness. 2. Data Storage in MongoDB:
- Employee data is stored in a MongoDB database under the hr_database database and employees collection.
- Vector embeddings are created for advanced querying using MongoDB Atlas Vector Search.

  Key Features

1. Schema Definition

The employee data adheres to a robust schema defined with zod, ensuring data validity and structure. It includes fields like:

- Personal details (name, date of birth, address, etc.).
- Job information (title, department, salary, etc.).
- Skills, performance reviews, and benefits.
- Emergency contacts and additional notes.

1. Synthetic Data Generation

- A prompt-driven LLM (e.g., GPT-4) is used to generate realistic employee data.
- The StructuredOutputParser ensures the LLM output matches the predefined schema.

1. Employee Summaries

- Summaries are dynamically generated for each employee, providing an easy-to-read overview of their profile, skills, and reviews.

2. MongoDB Integration

- The employees collection is reset (deleteMany) before seeding to ensure no duplication.
- Records are inserted into the database, enriched with vector embeddings for advanced text-based queries.

1. Vector Search Index

- The MongoDBAtlasVectorSearch integrates with OpenAI’s embeddings to create a vector_index for each record, enabling similarity-based searches across the dataset.

Usage 1. Setup:
• Install required dependencies:

```bash
npm install
```

Add a .env file with the MongoDB Atlas connection string:

```bash
MONGODB_ATLAS_URI=your_mongo_connection_string
OPENAI_API_KEY=your_openai_api_key
```

Run the Seeding Script:
Execute the script to seed the database:

```bash
ts-node ./seed_data/seed_database.ts
```

Example employee record

```json
{
  "employee_id": "EMP123",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1990-01-01",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "postal_code": "62701",
    "country": "USA"
  },
  "contact_details": {
    "email": "john.doe@example.com",
    "phone_number": "123-456-7890"
  },
  "job_details": {
    "job_title": "Software Engineer",
    "department": "IT",
    "hire_date": "2022-05-01",
    "employment_type": "Full-Time",
    "salary": 85000,
    "currency": "USD"
  },
  "skills": ["JavaScript", "React", "Node.js"],
  "performance_reviews": [
    {
      "review_date": "2023-01-01",
      "rating": 4.5,
      "comments": "Excellent performance and teamwork."
    }
  ],
  "benefits": {
    "health_insurance": "Standard Plan",
    "retirement_plan": "401k",
    "paid_time_off": 15
  },
  "emergency_contact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone_number": "098-765-4321"
  },
  "notes": "Looking forward to a promotion."
}
```
