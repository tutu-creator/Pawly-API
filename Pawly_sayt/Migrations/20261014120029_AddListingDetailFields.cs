using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pawly_sayt.Migrations
{
    /// <inheritdoc />
    public partial class AddListingDetailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Age",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Breed",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Conditions",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LostDate",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ObservedDuration",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "Listings",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Age",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Breed",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Conditions",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "LostDate",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "ObservedDuration",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "Listings");
        }
    }
}
