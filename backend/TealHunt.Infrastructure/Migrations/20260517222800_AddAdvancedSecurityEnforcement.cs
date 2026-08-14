using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TealHunt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdvancedSecurityEnforcement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastPasswordChangeDate",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MfaEnforced",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresPasswordChange",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastPasswordChangeDate",
                table: "users");

            migrationBuilder.DropColumn(
                name: "MfaEnforced",
                table: "users");

            migrationBuilder.DropColumn(
                name: "RequiresPasswordChange",
                table: "users");
        }
    }
}
