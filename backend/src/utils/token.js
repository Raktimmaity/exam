const crypto = require("crypto");

module.exports = function makeToken(size = 24) {
  return crypto.randomBytes(size).toString("hex");
};
