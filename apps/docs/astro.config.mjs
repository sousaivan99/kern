import starlight from "@astrojs/starlight"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc"

const modules = ["validation", "money", "date", "number", "string", "array", "object", "async"]

export default defineConfig({
  integrations: [
    starlight({
      title: "Kern",
      description: "Small, audited TypeScript primitives for modern JavaScript runtimes.",
      favicon: "/favicon.svg",
      customCss: ["./src/styles/global.css"],
      components: {
        Hero: "./src/components/HomeHero.astro",
        MarkdownContent: "./src/components/MarkdownContent.astro",
        MobileMenuToggle: "./src/components/MobileMenuToggle.astro",
        PageTitle: "./src/components/PageTitle.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      editLink: {
        baseUrl: "https://github.com/sousaivan99/kern/edit/main/apps/docs/",
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/sousaivan99/kern" }],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "New to JavaScript?", slug: "getting-started/from-zero" },
            { label: "Quick start", slug: "getting-started/quick-start" },
            { label: "Core ideas", slug: "getting-started/core-ideas" },
          ],
        },
        {
          label: "Framework tutorials",
          items: [
            { label: "JavaScript and TypeScript", slug: "frameworks/javascript-typescript" },
            { label: "Vue", slug: "frameworks/vue" },
            { label: "Nuxt", slug: "frameworks/nuxt" },
            { label: "React", slug: "frameworks/react" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Glossary", slug: "concepts/glossary" },
            { label: "Native first", slug: "concepts/native-first" },
            { label: "Tree-shaking", slug: "concepts/tree-shaking" },
          ],
        },
        {
          label: "Module guides",
          items: [
            { label: "All helpers", slug: "modules" },
            {
              label: "Validation",
              collapsed: true,
              items: [
                { label: "Overview", slug: "modules/validation" },
                { label: "Primitives", slug: "modules/validation/primitives" },
                { label: "Collections", slug: "modules/validation/collections" },
                {
                  label: "Modifiers and transforms",
                  slug: "modules/validation/modifiers-and-transforms",
                },
                {
                  label: "Errors and inference",
                  slug: "modules/validation/errors-and-inference",
                },
              ],
            },
            {
              label: "Money",
              collapsed: true,
              items: [
                { label: "Overview", slug: "modules/money" },
                {
                  label: "Formatting and parsing",
                  slug: "modules/money/formatting-and-parsing",
                },
                { label: "Arithmetic", slug: "modules/money/arithmetic" },
              ],
            },
            {
              label: "Date",
              collapsed: true,
              items: [
                { label: "Overview", slug: "modules/date" },
                {
                  label: "Arithmetic and boundaries",
                  slug: "modules/date/arithmetic-and-boundaries",
                },
                {
                  label: "Formatting and comparison",
                  slug: "modules/date/formatting-and-comparison",
                },
              ],
            },
            { label: "Number", slug: "modules/number" },
            { label: "String", slug: "modules/string" },
            { label: "Array", slug: "modules/array" },
            { label: "Object", slug: "modules/object" },
            { label: "Async", slug: "modules/async" },
          ],
        },
        typeDocSidebarGroup,
        {
          label: "Contributing",
          items: [{ label: "Development", slug: "contributing/development" }],
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: modules.map(
            (moduleName) => `../../packages/kern/src/${moduleName}/index.ts`,
          ),
          output: "reference",
          tsconfig: "../../packages/kern/tsconfig.build.json",
          sidebar: { label: "API reference", collapsed: true },
          typeDoc: {
            alwaysCreateEntryPointModule: true,
            entryPointStrategy: "resolve",
            excludeInternal: true,
            excludePrivate: true,
            excludeProtected: true,
            gitRemote: "origin",
            gitRevision: "main",
            readme: "none",
            requiredToBeDocumented: [
              "Class",
              "Function",
              "Interface",
              "Method",
              "Property",
              "TypeAlias",
              "Variable",
            ],
            treatValidationWarningsAsErrors: true,
            validation: {
              invalidLink: true,
              invalidPath: true,
              notDocumented: true,
              notExported: true,
            },
          },
        }),
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
