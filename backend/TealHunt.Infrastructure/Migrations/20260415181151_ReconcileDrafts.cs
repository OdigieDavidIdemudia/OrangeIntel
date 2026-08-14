using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TealHunt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReconcileDrafts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS advisory_drafts (
                    ""Id"" uuid NOT NULL,
                    ""TopicId"" uuid NULL,
                    ""AuthorId"" text NOT NULL,
                    ""ContentJson"" jsonb NOT NULL,
                    ""Version"" integer NOT NULL,
                    ""LastSavedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_advisory_drafts"" PRIMARY KEY (""Id"")
                );
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS assessment_drafts (
                    ""Id"" uuid NOT NULL,
                    ""AdvisoryId"" uuid NULL,
                    ""AuthorId"" text NOT NULL,
                    ""ContentJson"" jsonb NOT NULL,
                    ""Version"" integer NOT NULL,
                    ""LastSavedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_assessment_drafts"" PRIMARY KEY (""Id"")
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "advisory_drafts");

            migrationBuilder.DropTable(
                name: "assessment_drafts");
        }
    }
}
