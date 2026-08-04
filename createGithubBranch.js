/* HARDCODED CONFIG */
var owner = "gczetterptc";
var repo = "Gabor_branching_POC";
var baseBranch = "main";
var token = "in_codebeamer"

// JUST DMEO
var CUSTOM_FIELDS = {
    repository: 1.0,
    repositoryUrl: 6.0,
    branchName: 3.0,
    branchUrl: 7.0
};

// GETTING TOKEN FROM CONFIG WORKITEM
var tokenItemId = 1025407; // replace with your token item ID
var trackerItemManager = applicationContext.getBean("trackerItemManager");
var tokenItem = trackerItemManager.findById(new java.lang.Integer(tokenItemId));
if (tokenItem == null) {
    throw "Token item not found: " + tokenItemId;
}
token = tokenItem.getDescription();
// ===================== //


// ==================== //

var taskId = subject.getId();
var taskName = subject.getName();

// --- Safety guard: avoid first/null execution ---
if (taskId == null) {
    // Codebeamer may evaluate the script before the item is fully initialised
    throw "";
}

var branchName = "feature/cb-" + taskId + "-" + slugify(taskName);
//e.g: feature/cb-1025405-task-2

// ===============================
// 0. Get SHA of base branch
// ===============================
var url = new java.net.URL(
    "https://api.github.com/repos/gczetterptc/Gabor_branching_POC"
);

var conn = url.openConnection();

conn.setRequestMethod("GET");
conn.setRequestProperty("Authorization", "Bearer " + token);
conn.setRequestProperty("Accept", "application/vnd.github+json");


var code = conn.getResponseCode();

var stream = code >= 400
    ? conn.getErrorStream()
    : conn.getInputStream();

var reader = new java.io.BufferedReader(
    new java.io.InputStreamReader(stream)
);

var line;
var response = "";

while ((line = reader.readLine()) != null) {
    response += line;
}


// ===============================
// 1. Get SHA of base branch
// ===============================

var baseRefUrl =
    "https://api.github.com/repos/" +
    owner +
    "/" +
    repo +
    "/git/ref/heads/" +
    baseBranch;

var baseRefResult = githubRequest("GET", baseRefUrl, null);

if (baseRefResult.code != 200) {
    throw "Failed to get base branch SHA. HTTP " +
    baseRefResult.code +
    "\n" +
    baseRefResult.body;
}

// Extract SHA from response.
// Simple regex is enough for POC.
// Response contains: "object": { ... "sha": "..." }
var shaMatch = baseRefResult.body.match(/"sha"\s*:\s*"([^"]+)"/);

if (shaMatch == null || shaMatch.length < 2) {
    throw "Could not extract SHA from GitHub response:\n" +
    baseRefResult.body;
}

var baseSha = shaMatch[1];

// ===============================
// 2. Create new branch
// ===============================

var createRefUrl =
    "https://api.github.com/repos/" +
    owner +
    "/" +
    repo +
    "/git/refs";

var payload =
    '{' +
    '"ref":"refs/heads/' + branchName + '",' +
    '"sha":"' + baseSha + '"' +
    '}';

var createResult = githubRequest("POST", createRefUrl, payload);

// 201 = branch created successfully
if (createResult.code == 201) {
    var branchUrl =
        "https://github.com/" +
        owner +
        "/" +
        repo +
        "/tree/" +
        branchName;

    var repoName = repo;

    var repoUrl =
        "https://github.com/" +
        owner +
        "/" +
        repo;

    subject.setCustomField(CUSTOM_FIELDS.repository, repoName);
    subject.setCustomField(CUSTOM_FIELDS.repositoryUrl, "[" + repoUrl + "]");
    subject.setCustomField(CUSTOM_FIELDS.branchName, branchName);
    subject.setCustomField(CUSTOM_FIELDS.branchUrl, "[" + branchUrl + "]");

    throw "Branch created successfully:\n" +
    branchName +
    "\n\n" +
    branchUrl;
}

// 422 usually means branch already exists or invalid ref
if (createResult.code == 422) {
    throw "Branch was not created. It may already exist.\n\n" +
    "Branch: " +
    branchName +
    "\n\nGitHub response:\n" +
    createResult.body;
}

// Other errors
throw "Failed to create branch. HTTP " +
createResult.code +
"\n\n" +
createResult.body;



/* FUNCTIONS */

function slugify(text) {
    if (text == null) {
        return "task";
    }

    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 60);
}

function githubRequest(method, urlString, body) {
    var url = new java.net.URL(urlString);
    var conn = url.openConnection();

    conn.setRequestMethod(method);

    // GitHub REST API authentication with PAT
    conn.setRequestProperty("Authorization", "Bearer " + token);
    conn.setRequestProperty("Accept", "application/vnd.github+json");
    conn.setRequestProperty("X-GitHub-Api-Version", "2026-03-10");

    if (body != null) {
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");

        var os = conn.getOutputStream();
        os.write(new java.lang.String(body).getBytes("UTF-8"));
        os.close();
    }

    var code = conn.getResponseCode();
    var response = readResponse(conn);

    return {
        code: code,
        body: response
    };
}

function readResponse(conn) {
    var code = conn.getResponseCode();

    var stream = code >= 400
        ? conn.getErrorStream()
        : conn.getInputStream();

    if (stream == null) {
        return "";
    }

    var reader = new java.io.BufferedReader(
        new java.io.InputStreamReader(stream, "UTF-8")
    );

    var line;
    var response = "";

    while ((line = reader.readLine()) != null) {
        response += line;
    }

    reader.close();

    return response;
}