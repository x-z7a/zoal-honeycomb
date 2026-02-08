import { defineConfig } from "vitepress";

export default defineConfig({
  title: "zoal-honeycomb Docs",
  description: "Profile guides for non-programmers",
  base: "/",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Install", link: "/install" },
      { text: "Supported Planes", link: "/supported-planes" },
      { text: "Profile Fields", link: "/profile-fields" },
      { text: "Edit Profile", link: "/edit-existing-profile" },
      { text: "Create Profile", link: "/create-new-profile" },
      { text: "Publish Docs", link: "/publish-docs" }
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Home", link: "/" },
          { text: "Install", link: "/install" },
          { text: "Supported Planes", link: "/supported-planes" },
          { text: "Profile Field Reference", link: "/profile-fields" },
          { text: "Edit an Existing Profile", link: "/edit-existing-profile" },
          { text: "Create a New Profile", link: "/create-new-profile" },
          { text: "Publish Docs to GitHub Pages", link: "/publish-docs" }
        ]
      }
    ]
  }
});
