# Use the official .NET SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and restore all projects
COPY *.sln ./
COPY OrangeIntel.Api/*.csproj OrangeIntel.Api/
COPY OrangeIntel.Application/*.csproj OrangeIntel.Application/
COPY OrangeIntel.Domain/*.csproj OrangeIntel.Domain/
COPY OrangeIntel.Infrastructure/*.csproj OrangeIntel.Infrastructure/
COPY OrangeIntel.Tests/*.csproj OrangeIntel.Tests/
RUN dotnet restore

# Copy all the source code
COPY . .

# Build and Publish the API
WORKDIR /src/OrangeIntel.Api
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
