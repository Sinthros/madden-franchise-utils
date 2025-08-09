# Madden Franchise Utilities

Utilities for Madden - Utilizing the madden-franchise API by bep713.

This repository is intended for developers with a basic understanding of bep713's madden-franchise API. Ensure you have Node.js installed to run these scripts.

## Getting Started

1. Clone the repository:

    ```bash
    git clone https://github.com/your-username/madden-franchise-utils.git
    ```

2. Navigate to the project directory:

    ```bash
    cd madden-franchise-utils
    ```

3. Install dependencies:

    ```bash
    npm install
    ```

## Running Scripts

Scripts in this repository can be executed using the following command:

```bash
node scriptName.js
```

For example:

```bash
node generateVisuals.js
```

## Building Executables

To build a script into an executable, you can use [nexe](https://github.com/nexe/nexe). To install nexe globally:

```bash
npm install -g nexe
```

Then run a command similar to the following:

```bash
nexe --build -i testScript.js -t x64-14.15.3 -r "PATH_TO_NODE_MODULES/node_modules/madden-franchise/data/schemas" -r "*.json" -o "test.exe" --verbose
```

Please note that nexe requires both Python and NASM to be installed. You can download Python [here](https://www.python.org/downloads/) (version 3.9 is recommended). You can download NASM [here](https://www.nasm.us/).


The above example builds an executable (`test.exe`) from `testScript.js`, including schemas from the madden-franchise API and all JSON files in the current directory.

Replace `PATH_TO_NODE_MODULES` with the actual path to your `node_modules` directory.

### Building with pkg

You may notice that some scripts in this repository include a `pkgConfig.json` file. These scripts must be built using the [yao-pkg fork of pkg](https://github.com/yao-pkg/pkg). To install pkg globally, run:

```bash
npm install -g @yao-pkg/pkg
```

Then, you can build an executable using the following command:

```bash
pkg -c pkgConfig.json scriptName.js -o outputExecutable.exe
```

The `pkgConfig.json` file contains configuration options for the build process, including any requires script or asset dependencies and the target platform and node version. See the pkg repo linked above for more details on how this file should be formatted.