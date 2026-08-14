using System.Threading.Tasks;

namespace TealHunt.Application.Interfaces;

public interface IHibpService
{
    Task<bool> IsPasswordPwnedAsync(string password);
}
