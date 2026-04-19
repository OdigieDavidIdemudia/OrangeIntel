using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL") 
                    ?? builder.Configuration["DATABASE_URL"]
                    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrEmpty(connectionString))
{
    // Safety fallback for local development if everything else is missing
    connectionString = "Host=localhost;Port=5432;Database=orangeintel;Username=postgres;Password=password;";
}

if (!string.IsNullOrEmpty(connectionString) && (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://")))
{
    var databaseUri = new Uri(connectionString);
    var userInfo = databaseUri.UserInfo.Split(':', 2);
    var host = databaseUri.Host;
    var port = databaseUri.Port;
    var database = databaseUri.LocalPath.TrimStart('/');
    var username = userInfo[0];
    var password = userInfo.Length > 1 ? userInfo[1] : "";
    
    // Add SSL common for cloud providers like Render/Railway
    connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true;Include Error Detail=true;";
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddIdentity<AppUser, IdentityRole>(options => options.SignIn.RequireConfirmedAccount = false)
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IThreatRepository, OrangeIntel.Infrastructure.Repositories.ThreatRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IAdvisoryRepository, OrangeIntel.Infrastructure.Repositories.AdvisoryRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Services.IThreatService, OrangeIntel.Application.Services.ThreatService>();
builder.Services.AddScoped<OrangeIntel.Application.Services.IAdvisoryService, OrangeIntel.Application.Services.AdvisoryService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.INotificationProvider, OrangeIntel.Infrastructure.Notifications.SignalNotificationProvider>();
builder.Services.AddScoped<OrangeIntel.Application.Services.INotificationService, OrangeIntel.Application.Services.NotificationService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IReportRepository, OrangeIntel.Infrastructure.Repositories.ReportRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Services.IReportService, OrangeIntel.Application.Services.ReportService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IAssessmentRepository, OrangeIntel.Infrastructure.Repositories.AssessmentRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IReportGenerator, OrangeIntel.Infrastructure.Reporting.DocxReportGenerator>();

// Security Services
builder.Services.AddSingleton<OrangeIntel.Infrastructure.Services.EncryptionService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.ITokenService, OrangeIntel.Infrastructure.Services.JwtTokenService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IOneTimePasswordService, OrangeIntel.Infrastructure.Services.OneTimePasswordService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IAuditService, OrangeIntel.Infrastructure.Services.AuditService>();

// Threat Ingestion
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.Services.ThreatIngestionService>();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "super_secret_key_change_me_in_prod_12345!"; // Fallback for dev
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "OrangeIntel",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "OrangeIntelUser",
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey))
    };
});

builder.Services.AddHealthChecks();
builder.Services.AddControllers(options =>
{
    var policy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                     .RequireAuthenticatedUser()
                     .Build();
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.Authorization.AuthorizeFilter(policy));
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) // Safely allows wildcards across dynamic Vercel domains
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}

// NOTE: Do NOT use UseHttpsRedirection() on Render/Railway.
// Render terminates HTTPS at their proxy layer and forwards plain HTTP to the app.
// Enabling this causes infinite redirect loops (500 errors on login/all endpoints).

app.UseCors("FrontendPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/api/health").AllowAnonymous();

// Database Initialization
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var env = services.GetRequiredService<IWebHostEnvironment>();
    try
    {
        await DbInitializer.Initialize(services, false); // Persistence enabled
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

app.Run();
