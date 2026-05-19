# Admin setup for TurfOps

Use these steps to create your first real employee login and grant yourself admin access.

## 1. Register your employee account

With the backend running, create your account:

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "fullName": "Your Name",
    "password": "choose-a-strong-password"
  }'
```

Save the returned `id` value. You will use it as `employeeId` below.

## 2. Create at least one golf course if needed

Right now courses come from the database. If you do not yet have one, insert one manually:

```bash
sudo -u postgres psql -d greenkeeper_ops
```

Then:

```sql
insert into courses (name, region, superintendent_name)
values ('My Test Golf Course', 'Denver, CO', 'Brandon');

select id, name from courses;
\q
```

Save the course `id`.

## 3. Temporarily grant yourself admin rights

Because membership management itself is admin-protected, bootstrap the first admin directly in SQL:

```bash
sudo -u postgres psql -d greenkeeper_ops
```

Then:

```sql
insert into course_memberships (employee_id, course_id, role)
values ('YOUR_EMPLOYEE_ID', 'YOUR_COURSE_ID', 'admin');
\q
```

## 4. Log into the app

Use your email and password on the login screen.

## 5. Test admin access

As admin, you should be able to:
- see the course in the selector
- create work orders
- create equipment records
- create employee accounts directly in the app
- manage employee roles for that course
- view recent audit activity for that course

## 6. Test invite-based onboarding

When you create an employee from the admin UI:
- copy the generated invite token or URL
- open the invite flow and set the employee's password
- confirm the employee can sign in afterward
- confirm the audit log records `employee.invite` and `invite.accept`
