// search.js
const { searchForPlayer } = require("./footballDBUtils");

// Example usage: search for "Chris Brown"
const playerName = "Chris Brown";

searchForPlayer(playerName)
  .then(() => console.log("Search complete"))
  .catch((err) => console.error("Error during search:", err));
