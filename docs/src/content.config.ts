import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';

export const collections = {
  // The 'docs' key is required by Starlight to build the sidebar and pages
  docs: defineCollection({
    // 1. Tell Astro explicitly how to load the markdown files
    loader: docsLoader(),

    // 2. Pass Starlight's validated frontmatter schema
    schema: docsSchema(),
  }),
};
