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

This example builds an executable (`test.exe`) from `testScript.js`, including schemas from the madden-franchise API and all JSON files in the current directory.

Replace `PATH_TO_NODE_MODULES` with the actual path to your `node_modules` directory.