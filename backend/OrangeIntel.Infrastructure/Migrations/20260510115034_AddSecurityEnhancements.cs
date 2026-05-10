using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrangeIntel.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSecurityEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SignalPhoneNumber",
                table: "users",
                newName: "TelegramChatId");

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TokenVersion",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FullName",
                table: "users");

            migrationBuilder.DropColumn(
                name: "TokenVersion",
                table: "users");

            migrationBuilder.RenameColumn(
                name: "TelegramChatId",
                table: "users",
                newName: "SignalPhoneNumber");
        }
    }
}
