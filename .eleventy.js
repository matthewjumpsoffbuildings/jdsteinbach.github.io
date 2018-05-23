// const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function(eleventyConfig) {
  // eleventyConfig.addPlugin(pluginRss);
  // eleventyConfig.addPlugin(pluginSyntaxHighlight);

  eleventyConfig.addLayoutAlias("post", "post.liquid");
  eleventyConfig.addLayoutAlias("page", "page.liquid");
  eleventyConfig.addLayoutAlias("category", "category.liquid");
  eleventyConfig.addLayoutAlias("home", "home.liquid");
  eleventyConfig.addLayoutAlias("blog", "blog.liquid");

  eleventyConfig.addFilter("imageID", titleString => {
    return titleString.length % 5 + 1;
  });

  eleventyConfig.addFilter("paginate_better", id => id + 1);

  eleventyConfig.addFilter("fix_links", url => url.replace('/index.html', '/'));

  eleventyConfig.addFilter("debug", something => typeof something);

  // Create Posts Collection
  eleventyConfig.addCollection("posts", function(collection) {
    return collection
      .getAllSorted()
      .reverse()
      .filter(function(item) {
        return item.inputPath.match(/^\.\/posts\//) !== null;
      });
  });

  // Create Posts Collection
  eleventyConfig.addCollection("postsIndex", function(collection) {
    return collection
      .getAllSorted()
      .filter(function(item) {
        return item.inputPath.match(/^\.\/posts\//) !== null;
      })
      .slice(0, 8);
  });

  // Create Category Collections
  eleventyConfig.addCollection("CSS", function(collection) {
    return collection
      .getAllSorted()
      .reverse()
      .filter(function(item) {
        if ("categories" in item.data) {
          return item.data.categories.filter(function(category) {
            return category.toLowerCase() === "CSS".toLowerCase()
          }).length > 0;
        }
        return false;
      });
  });

  eleventyConfig.addCollection("Sass", function(collection) {
    return collection
      .getAllSorted()
      .reverse()
      .filter(function(item) {
        if ("categories" in item.data) {
          return item.data.categories.filter(function(category) {
            return category.toLowerCase() === "Sass".toLowerCase()
          }).length > 0;
        }
        return false;
      });
  });

  eleventyConfig.addCollection("Misc", function(collection) {
    return collection
      .getAllSorted()
      .reverse()
      .filter(function(item) {
        if ("categories" in item.data) {
          return item.data.categories.filter(function(category) {
            return category.toLowerCase() === "Misc".toLowerCase()
          }).length > 0;
        }
        return false;
      });
  });

  eleventyConfig.addCollection("WordPress", function(collection) {
    return collection
      .getAllSorted()
      .reverse()
      .filter(function(item) {
        if ("categories" in item.data) {
          return item.data.categories.filter(function(category) {
            return category.toLowerCase() === "WordPress".toLowerCase()
          }).length > 0;
        }
        return false;
      });
  });


  // Create Nav Collection
  eleventyConfig.addCollection("nav", function(collection) {
    return collection
      .getAll()
      .filter(function(item) {
        return "menu_order" in item.data;
      })
      .sort(function(a, b) {
        return a.data.menu_order > b.data.menu_order;
      });
  });

  // Pass through directories
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("webfonts");

  return {
    templateFormats: [
      "md"
    ],
    // pathPrefix: "/",


    // markdownTemplateEngine: "liquid",
    // htmlTemplateEngine: "liquid",
    // dataTemplateEngine: "liquid",

    // passthroughFileCopy: true,
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};