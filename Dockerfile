# Use the official .NET SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and restore all projects
COPY backend/*.sln ./backend/
COPY backend/OrangeIntel.Api/*.csproj backend/OrangeIntel.Api/
COPY backend/OrangeIntel.Application/*.csproj backend/OrangeIntel.Application/
COPY backend/OrangeIntel.Domain/*.csproj backend/OrangeIntel.Domain/
COPY backend/OrangeIntel.Infrastructure/*.csproj backend/OrangeIntel.Infrastructure/
COPY backend/OrangeIntel.Tests/*.csproj backend/OrangeIntel.Tests/

WORKDIR /src/backend
RUN dotnet restore

# Copy all the remaining source code
WORKDIR /src
COPY backend/ backend/

# Build and Publish the API
WORKDIR /src/backend/OrangeIntel.Api
RUN dotnet publish -c Release -o /app/publish

# Use the lighter ASP.NET Core runtime image to run the app
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose standard web port
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Configure the entry point
ENTRYPOINT ["dotnet", "OrangeIntel.Api.dll"]
