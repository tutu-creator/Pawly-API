using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pawly_sayt.Migrations
{
    /// <inheritdoc />
    public partial class ContactInfoOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContactPhone",
                table: "Listings");

            migrationBuilder.AddColumn<string>(
                name: "ContactInfo",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContactInfo",
                table: "Listings");

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }
    }
}
