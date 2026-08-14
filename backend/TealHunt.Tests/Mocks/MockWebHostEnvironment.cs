using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace TealHunt.Tests.Mocks;

public class MockWebHostEnvironment : IWebHostEnvironment
{
    public string WebRootPath { get; set; }
    public IFileProvider WebRootFileProvider { get; set; }
    public string ApplicationName { get; set; }
    public IFileProvider ContentRootFileProvider { get; set; }
    public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
    public string EnvironmentName { get; set; } = "Development";
}
