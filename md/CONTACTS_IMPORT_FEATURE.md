# GC Contacts Import Feature

This feature allows General Contractors (GCs) to import and manage their own contractor contacts, enabling them to send job requests to their personal network.

## Features

### 1. Contact Import
- **File Formats**: Supports CSV and Excel (.xlsx, .xls) files
- **Bulk Import**: Import up to 1000 contacts at once
- **Template Download**: Download a CSV template with the correct format
- **Validation**: Automatic validation of email formats and required fields
- **Error Handling**: Detailed error reporting for failed imports

### 2. Contact Management
- **CRUD Operations**: Create, read, update, and delete contacts
- **Search & Filter**: Search by name, email, or company; filter by trade category and location
- **Contact Details**: Store name, email, company, phone, trade category, location, and notes

### 3. Database Schema
- **Table**: `gc_contacts`
- **Security**: Row Level Security (RLS) ensures GCs can only access their own contacts
- **Unique Constraint**: Each GC can have unique email addresses (same contact can exist for different GCs)

## Database Migration

Run the following SQL migration in your Supabase SQL editor:

```sql
-- See: supabase-migration-gc-contacts.sql
```

## API Endpoints

### Import Contacts
```
POST /api/contacts/import
Content-Type: multipart/form-data

Body: file (CSV or Excel file)
```

### Manage Contacts
```
GET /api/contacts?trade_category=Electrical&location=San Francisco&search=john
POST /api/contacts
PUT /api/contacts
DELETE /api/contacts?id=contact_id
```

## File Format

### CSV Template
```csv
email,name,company,phone,trade_category,location,notes
example@email.com,John Doe,ABC Construction,555-1234,Electrical,San Francisco CA,Great electrician
```

### Required Fields
- `email`: Valid email address
- `name`: Contact's full name
- `trade_category`: One of the predefined trade categories
- `location`: Geographic location

### Optional Fields
- `company`: Company name
- `phone`: Phone number
- `notes`: Additional notes

### Valid Trade Categories
- Electrical
- Plumbing
- HVAC
- Roofing
- Flooring
- Painting
- Drywall
- Carpentry
- Concrete
- Landscaping
- Excavation
- Insulation
- Windows & Doors
- Siding
- General Construction
- Renovation
- Other

## Usage

1. **Access**: Navigate to Dashboard → My Contacts
2. **Import**: Click "Import Contacts" and upload a CSV or Excel file
3. **Manage**: Add, edit, or delete individual contacts
4. **Search**: Use the search and filter options to find specific contacts

## Future Enhancements

This feature is designed to support future enhancements:
- **Job Request Targeting**: Choose to send job requests to personal network, platform network, or both
- **Contact Groups**: Organize contacts into groups or categories
- **Contact History**: Track interaction history with contacts
- **Integration**: Connect with external contact management systems

## Security

- **Authentication**: Only authenticated GCs can access the feature
- **Authorization**: RLS policies ensure data isolation between GCs
- **Validation**: Server-side validation of all inputs
- **File Upload**: Secure file handling with type validation

## Dependencies

- `xlsx`: For Excel file parsing
- Supabase: For database operations and authentication
- Next.js: For API routes and frontend components
