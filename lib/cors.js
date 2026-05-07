function setPublicCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handleCorsPreflight(request, response) {
  setPublicCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return true;
  }

  return false;
}

module.exports = {
  handleCorsPreflight,
  setPublicCorsHeaders,
};
