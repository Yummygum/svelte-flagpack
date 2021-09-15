# Contributing

## Bug fixes

Issues can be found on our [GitHub issues](https://github.com/yummygum/svelte-flagpack/issues) page. Found a bug? Let us know! Report the bug by [creating a new issue](https://github.com/Yummygum/svelte-flagpack/issues/new/choose). Make sure to check the issues page before creating a new bug issue to prevent duplicate issues. Once you start fixing a bug, post your intent on the issue to prevent others diving in at the same time.

## New features

Upcoming new features can be found on our [GitHub issues](https://github.com/yummygum/svelte-flagpack/issues) page. Do you want to contribute by adding new features, open a [Feature Request](https://github.com/Yummygum/svelte-flagpack/issues/new/choose).

## Documentation

If a PR introduces or changes API, mention one of the Yummygum team members to make sure it'll be processed into the [website docs](https://flagpack.xyz/docs/).

# Development

If you wish to run the package locally, go through the following steps:

1. Fork the `svelte-flagpack` repo and clone your fork to your system:
```bash
$: git clone https://github.com/{your-username}/svelte-flagpack.git
```
2. Install the package

```bash
$: npm install
```

3. Run npm link to create a local instance of the package
```bash
$: npm link
```

4. Now install the app you're using flagpack in, for this instance we'll be using [a Svelte template app](https://github.com/sveltejs/template):
```bash
$: npx degit sveltejs/template my-svelte-project
```

5. use `cd` to move into the app directory and use `npm link` to add your local instance of `svelte-flagpack`
```bash
# move into directory
$: cd my-svelte-project

# add local instance of svelte-flagpack
$: npm link svelte-flagpack
```

6. Now in the `svelte-flagpack` run the dev script so your changes are updated automatically
```bash
$: npm run dev
```

7. You're now ready to go to develop on the `svelte-flagpack` package!
## Building the package
Building the package should only ever be needed if there are changes from the `flagpack-core` devDependency. `svelte-flagpack`
 will be built based on the `CountryCodeList.json` in `flagpack-core`.

To build `svelte-flagpack` go through the following steps:

1. Update `flagpack-core` to the latest version
2. Run the `build` script in `svelte-flagpack`
```bash
$: npm run build
```


## Releasing
If you have proper credentials, like a @yummygum team member, you can release a new version of `svelte-flagpack`.

To release a new version you'll need to make sure all changes commits are done and pushed. Please follow the [semver](https://semver.org/) guidelines to decide what kind of release type your changes would translate to.

```
$: npm version <release_type>
```
This will update the version number in the `package.json`, and will add a git tag automatically. Next you'll need to push the git tag to the remote.
```
$: git push --tags origin main
```
After that you'll need to publish to npm.
```
$: npm publish
```

When you're confident with the release, make sure the version tag is also released at GitHub.

Follow these steps to get your code PR-ready:

- Make sure your code is linted and formatted nicely according to the style guide
- Create a PR and mention what changes you made
