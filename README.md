# Pawly API – Back End for Stray & Lost Animal Support Platform

REST API for [Pawly](https://pawlysite.bsite.net/), a live platform for Azerbaijan that helps people report stray animals, post lost pet listings and flag animals that need care.

**Front end repository:** [Animal-sayt](https://github.com/tutu-creator/Animal-sayt)

## Features
- REST API with full CRUD for listings (stray, lost, needs care)
- User registration and login with JWT authentication
- Email confirmation and password reset
- Image upload with server-side HEIC to JPEG conversion (Magick.NET)
- Relational database with Entity Framework Core migrations
- Layered structure: Controllers, Services, DTOs, Models

## Built With
- C#, ASP.NET Core
- Entity Framework Core, SQL Server
- JWT Authentication
- Magick.NET

## Getting Started
1. Clone the repository.
2. Fill in the placeholder values in `appsettings.json` and `appsettings.Production.json` (connection string, JWT key, email settings).
3. Run database migrations: `dotnet ef database update`
4. Start the API: `dotnet run --project Pawly_sayt`

## Status
Live and in active development.
