using System.Threading.Tasks;

namespace OrangeIntel.Application.Interfaces;

public interface IHibpService
{
    Task<bool> IsPasswordPwnedAsync(string password);
}
