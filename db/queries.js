// db/queries.js
//
// =============================================================================
//  THIS IS THE FILE YOU EDIT.
// =============================================================================
//
// All 15 query functions you need to implement live in this file. Every
// function has:
//
//   • A description of what it should do
//   • The exact parameters and return shape expected by the routes
//   • A hint about which Mongo operator/method fits
//   • A // TODO marker where you write your code
//
// Do NOT change function names, parameter order, or return shapes —
// the routes call these functions exactly as defined here. If you change
// the contract, the frontend will break.
//
// All functions receive `db` (the connected MongoDB Db instance) as the first
// argument. Use `db.collection("users")`, `db.collection("projects")`, etc.
//
// MUST USE: native `mongodb` driver only. No Mongoose, no ODM.
// =============================================================================

const { ObjectId } = require('mongodb');

// ─── Debug helper: set this to false to silence pipeline logs ────────────────
const DEBUG_AGGREGATION = true;

/**
 * Pretty-print a pipeline stage's output to the console.
 * @param {string} stageName  — e.g. "After $match"
 * @param {Array|Object} data
 */
function logStage(stageName, data) {
  if (!DEBUG_AGGREGATION) return;
  console.log(`\n🔹 ${stageName}`);
  console.log(JSON.stringify(data, null, 2));
  console.log(`   (${Array.isArray(data) ? data.length : 'N/A'} document(s))`);
}

/**
 * Query 1: signupUser
 * -------------------------------------------------------------
 * Insert a new user document. Email must be globally unique
 * (a duplicate email should be rejected by the database).
 *
 * @param {Db} db
 * @param {{ email: string, passwordHash: string, name: string }} userData
 * @returns {Promise<{ insertedId: ObjectId }>}
 *
 * Expected behaviour:
 *   - If email is unique → returns { insertedId: <new ObjectId> }
 *   - If email already exists → MongoDB throws a duplicate-key error
 *     (the route catches this and shows "email taken")
 *
 * The document you insert should also include `createdAt: new Date()`.
 *
 * Hint: insertOne. Nothing fancy.
 */
async function signupUser(db, userData) {
  const result = await db.collection('users').insertOne({
    email: userData.email,
    passwordHash: userData.passwordHash,
    name: userData.name,
    createdAt: new Date()
  });
  return { insertedId: result.insertedId };
}

/**
 * Query 2: loginFindUser
 * -------------------------------------------------------------
 * Find a user by email so the route can compare passwords.
 *
 * @param {Db} db
 * @param {string} email
 * @returns {Promise<Object|null>}
 *
 * Expected output shape:
 *   { _id: ObjectId, email: "...", passwordHash: "...", name: "...", createdAt: Date }
 *   or null if no user with that email exists.
 *
 * Hint: findOne with an exact-match filter.
 */
async function loginFindUser(db, email) {
  return db.collection('users').findOne({ email: email });
}

/**
 * Query 3: listUserProjects
 * -------------------------------------------------------------
 * List all NON-archived projects belonging to one user, newest first.
 *
 * @param {Db} db
 * @param {ObjectId} ownerId
 * @returns {Promise<Array<Object>>}
 *
 * Expected output: array of project documents, each shaped like:
 *   { _id, ownerId, name, archived: false, createdAt, ... }
 *   sorted by createdAt descending.
 *
 * Hint: find with two filter conditions, then .sort().toArray().
 */
async function listUserProjects(db, ownerId) {
  return db.collection('projects')
    .find({ ownerId: ownerId, archived: false })
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Query 4: createProject
 * -------------------------------------------------------------
 * Insert a new project for a user.
 *
 * @param {Db} db
 * @param {{ ownerId: ObjectId, name: string, description?: string }} projectData
 * @returns {Promise<{ insertedId: ObjectId }>}
 *
 * The document should default `archived: false` and set `createdAt: new Date()`.
 *
 * Hint: insertOne again — just remember to add the defaults yourself.
 */
async function createProject(db, projectData) {
  const doc = {
    ownerId: projectData.ownerId,
    name: projectData.name,
    description: projectData.description || null,
    archived: false,
    createdAt: new Date()
  };
  const result = await db.collection('projects').insertOne(doc);
  return { insertedId: result.insertedId };
}

/**
 * Query 5: archiveProject
 * -------------------------------------------------------------
 * Mark a project as archived (do not delete).
 *
 * @param {Db} db
 * @param {ObjectId} projectId
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 *
 * Expected behaviour:
 *   - matched and modified should both be 1 on success
 *   - matched=0 if projectId doesn't exist
 *
 * Hint: updateOne with the $set operator.
 */
async function archiveProject(db, projectId) {
  const result = await db.collection('projects').updateOne(
    { _id: projectId },
    { $set: { archived: true } }
  );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

/**
 * Query 6: listProjectTasks
 * -------------------------------------------------------------
 * List tasks for one project, with an optional status filter,
 * sorted by priority descending then createdAt descending.
 *
 * @param {Db} db
 * @param {ObjectId} projectId
 * @param {string} [status]  — optional. One of "todo" | "in-progress" | "done".
 *                             If omitted, return tasks of ALL statuses.
 * @returns {Promise<Array<Object>>}
 *
 * Expected output: array of task documents.
 *
 * Hint: build the filter object dynamically. Only add the `status` key when
 *       the caller passed one. Then chain .sort({ priority: -1, createdAt: -1 }).
 */
async function listProjectTasks(db, projectId, status) {
  const filter = { projectId: projectId };
  if (status) {
    filter.status = status;
  }
  return db.collection('tasks')
    .find(filter)
    .sort({ priority: -1, createdAt: -1 })
    .toArray();
}

/**
 * Query 7: createTask
 * -------------------------------------------------------------
 * Insert a new task. Tasks have embedded subtasks and a tags array.
 *
 * @param {Db} db
 * @param {{
 *   ownerId: ObjectId,
 *   projectId: ObjectId,
 *   title: string,
 *   priority?: number,         // default 1
 *   tags?: string[],           // default []
 *   subtasks?: Array<{title: string, done: boolean}>  // default []
 * }} taskData
 * @returns {Promise<{ insertedId: ObjectId }>}
 *
 * The inserted document should also include `status: "todo"` and
 * `createdAt: new Date()`.
 *
 * Hint: insertOne. Apply defaults for any missing optional fields.
 */
async function createTask(db, taskData) {
  const doc = {
    ownerId: taskData.ownerId,
    projectId: taskData.projectId,
    title: taskData.title,
    status: 'todo',
    priority: taskData.priority !== undefined ? taskData.priority : 1,
    tags: taskData.tags || [],
    subtasks: taskData.subtasks || [],
    createdAt: new Date()
  };
  const result = await db.collection('tasks').insertOne(doc);
  return { insertedId: result.insertedId };
}

/**
 * Query 8: updateTaskStatus
 * -------------------------------------------------------------
 * Change a task's status field.
 *
 * @param {Db} db
 * @param {ObjectId} taskId
 * @param {string} newStatus  — "todo" | "in-progress" | "done"
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 *
 * Hint: updateOne + $set.
 */
async function updateTaskStatus(db, taskId, newStatus) {
  const result = await db.collection('tasks').updateOne(
    { _id: taskId },
    { $set: { status: newStatus } }
  );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

/**
 * Query 9: addTaskTag
 * -------------------------------------------------------------
 * Append a tag to a task's tags array, BUT only if it isn't already present.
 *
 * @param {Db} db
 * @param {ObjectId} taskId
 * @param {string} tag
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 *
 * Expected behaviour:
 *   - If tag is new → modifiedCount = 1, tags array gains the new entry
 *   - If tag is already present → modifiedCount = 0 (no duplicate added)
 *
 * Hint: which array operator silently skips duplicates? It is NOT $push.
 */
async function addTaskTag(db, taskId, tag) {
  const result = await db.collection('tasks').updateOne(
    { _id: taskId },
    { $addToSet: { tags: tag } }
  );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

/**
 * Query 10: removeTaskTag
 * -------------------------------------------------------------
 * Remove a tag from a task's tags array.
 *
 * @param {Db} db
 * @param {ObjectId} taskId
 * @param {string} tag
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 *
 * Expected behaviour:
 *   - If tag was present → modifiedCount = 1
 *   - If tag wasn't present → modifiedCount = 0
 *
 * Hint: $pull.
 */
async function removeTaskTag(db, taskId, tag) {
  const result = await db.collection('tasks').updateOne(
    { _id: taskId },
    { $pull: { tags: tag } }
  );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

/**
 * Query 11: toggleSubtask
 * -------------------------------------------------------------
 * Inside a task's `subtasks` array, find the subtask whose title
 * matches `subtaskTitle` and flip its `done` field to `newDone`.
 *
 * @param {Db} db
 * @param {ObjectId} taskId
 * @param {string} subtaskTitle
 * @param {boolean} newDone
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 *
 * Example: a task has subtasks: [
 *   { title: "Draft outline", done: false },
 *   { title: "Write intro",  done: false }
 * ]
 * Calling toggleSubtask(db, taskId, "Write intro", true) should produce:
 *   [
 *     { title: "Draft outline", done: false },
 *     { title: "Write intro",  done: true  }
 *   ]
 *
 * Hint: this is the POSITIONAL OPERATOR scenario. Your filter must
 *       reference the subtask by title (so Mongo knows which array element
 *       matched), and your $set path uses `subtasks.$.done`.
 */
async function toggleSubtask(db, taskId, subtaskTitle, newDone) {
  const result = await db.collection('tasks').updateOne(
    {
      _id: taskId,
      'subtasks.title': subtaskTitle
    },
    {
      $set: { 'subtasks.$.done': newDone }
    }
  );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

/**
 * Query 12: deleteTask
 * -------------------------------------------------------------
 * Permanently delete a task.
 *
 * @param {Db} db
 * @param {ObjectId} taskId
 * @returns {Promise<{ deletedCount: number }>}
 *
 * Hint: deleteOne.
 */
async function deleteTask(db, taskId) {
  const result = await db.collection('tasks').deleteOne({ _id: taskId });
  return { deletedCount: result.deletedCount };
}

/**
 * Query 13: searchNotes
 * -------------------------------------------------------------
 * Find notes belonging to a user that match ANY of the given tags.
 * Optionally restrict to one project.
 *
 * @param {Db} db
 * @param {ObjectId} ownerId
 * @param {string[]} tags        — match notes whose tags array contains
 *                                 at least one of these
 * @param {ObjectId} [projectId] — optional. If given, restrict to this project.
 * @returns {Promise<Array<Object>>}
 *
 * Expected output: array of note documents matching the filter,
 *                  sorted by createdAt descending.
 *
 * Hint: the operator that says "field's value is one of these" is $in.
 *       Build the filter conditionally based on whether projectId was passed.
 */
async function searchNotes(db, ownerId, tags, projectId) {
  const filter = {
    ownerId: ownerId,
    tags: { $in: tags }
  };
  if (projectId) {
    filter.projectId = projectId;
  }
  return db.collection('notes')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Query 14: projectTaskSummary
 * -------------------------------------------------------------
 * For one user, return per-project counts of tasks grouped by status,
 * with the project name attached. THIS IS THE NoSQL "JOIN".
 *
 * @param {Db} db
 * @param {ObjectId} ownerId
 * @returns {Promise<Array<Object>>}
 *
 * Expected output shape — one document per project:
 *   {
 *     _id: ObjectId,             // the projectId
 *     projectName: "Final Year Project",
 *     todo: 3,
 *     inProgress: 2,
 *     done: 5,
 *     total: 10
 *   }
 *
 * Pipeline outline:
 *   1. $match    — only this user's tasks
 *   2. $group    — group by projectId; use $sum with $cond to count per status
 *                  e.g. todo: { $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] } }
 *   3. $lookup   — join "projects" collection to get the name. Use:
 *                    from: "projects", localField: "_id",
 *                    foreignField: "_id", as: "project"
 *   4. $unwind   — flatten the joined "project" array (it has at most 1 element)
 *   5. $project  — reshape into the expected output above
 *
 * Hint: $lookup returns an ARRAY (because joins can match many).
 *       $unwind turns a 1-element array into the element itself.
 */
async function projectTaskSummary(db, ownerId) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 AGGREGATION: projectTaskSummary');
  console.log('='.repeat(60));
  console.log(`ownerId: ${ownerId}\n`);

  // Step 1: $match
  const afterMatch = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } }
  ]).toArray();
  logStage('Step 1 — After $match (only this user\'s tasks)', afterMatch);

  // Step 2: $group
  const afterGroup = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    {
      $group: {
        _id: '$projectId',
        todo: {
          $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
        },
        done: {
          $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] }
        },
        total: { $sum: 1 }
      }
    }
  ]).toArray();
  logStage('Step 2 — After $group (counts per projectId)', afterGroup);

  // Step 3: $lookup
  const afterLookup = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    {
      $group: {
        _id: '$projectId',
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        total: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'project'
      }
    }
  ]).toArray();
  logStage('Step 3 — After $lookup (projects array joined)', afterLookup);

  // Step 4: $unwind
  const afterUnwind = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    {
      $group: {
        _id: '$projectId',
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        total: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'project'
      }
    },
    { $unwind: '$project' }
  ]).toArray();
  logStage('Step 4 — After $unwind (project field flattened)', afterUnwind);

  // Step 5: Final — $project reshape + execute
  const result = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    {
      $group: {
        _id: '$projectId',
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        total: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'project'
      }
    },
    { $unwind: '$project' },
    {
      $project: {
        _id: 1,
        projectName: '$project.name',
        todo: 1,
        inProgress: '$inProgress',
        done: 1,
        total: 1
      }
    }
  ]).toArray();

  console.log('🔹 Step 5 — Final result (after $project reshape)');
  console.log(JSON.stringify(result, null, 2));
  console.log(`   (${result.length} project(s))\n`);

  // Verification
  result.forEach(doc => {
    const sum = doc.todo + doc.inProgress + doc.done;
    const check = sum === doc.total ? '✅' : '❌';
    console.log(`   ${check} ${doc.projectName}: todo=${doc.todo} inProgress=${doc.inProgress} done=${doc.done} total=${doc.total}`);
  });

  console.log('='.repeat(60) + '\n');
  return result;
}

/**
 * Query 15: recentActivityFeed
 * -------------------------------------------------------------
 * The 10 most recently created tasks across all of a user's projects,
 * each one annotated with its project's name. ALSO uses $lookup.
 *
 * @param {Db} db
 * @param {ObjectId} ownerId
 * @returns {Promise<Array<Object>>}
 *
 * Expected output — 10 task documents (or fewer if user has < 10), each shaped:
 *   {
 *     _id, title, status, priority, createdAt,
 *     projectId,
 *     projectName: "..."   // joined in
 *   }
 *
 * Pipeline outline:
 *   1. $match    — only this user's tasks
 *   2. $sort     — newest first
 *   3. $limit    — 10
 *   4. $lookup   — join "projects" to get the name
 *   5. $unwind   — flatten the joined array
 *   6. $project  — keep the fields above (drop the rest)
 *
 * Hint: putting $sort and $limit BEFORE $lookup is intentional —
 *       you only want to look up 10 projects, not all of them.
 */
async function recentActivityFeed(db, ownerId) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 AGGREGATION: recentActivityFeed');
  console.log('='.repeat(60));
  console.log(`ownerId: ${ownerId}\n`);

  // Step 1: $match
  const afterMatch = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } }
  ]).toArray();
  logStage('Step 1 — After $match (all user\'s tasks)', afterMatch.map(t => ({
    _id: t._id, title: t.title, status: t.status, createdAt: t.createdAt
  })));

  // Step 2: $sort
  const afterSort = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    { $sort: { createdAt: -1 } }
  ]).toArray();
  logStage('Step 2 — After $sort (newest first)', afterSort.map(t => ({
    _id: t._id, title: t.title, createdAt: t.createdAt
  })));

  // Step 3: $limit
  const afterLimit = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 }
  ]).toArray();
  logStage('Step 3 — After $limit (top 10)', afterLimit.map(t => ({
    _id: t._id, title: t.title, createdAt: t.createdAt
  })));

  // Step 4: $lookup
  const afterLookup = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'projects',
        localField: 'projectId',
        foreignField: '_id',
        as: 'project'
      }
    }
  ]).toArray();
  logStage('Step 4 — After $lookup (project array joined)', afterLookup.map(t => ({
    _id: t._id, title: t.title, project: t.project
  })));

  // Step 5: $unwind
  const afterUnwind = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'projects',
        localField: 'projectId',
        foreignField: '_id',
        as: 'project'
      }
    },
    { $unwind: '$project' }
  ]).toArray();
  logStage('Step 5 — After $unwind (project flattened)', afterUnwind.map(t => ({
    _id: t._id, title: t.title, projectName: t.project?.name
  })));

  // Step 6: Final — $project reshape + execute
  const result = await db.collection('tasks').aggregate([
    { $match: { ownerId: ownerId } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'projects',
        localField: 'projectId',
        foreignField: '_id',
        as: 'project'
      }
    },
    { $unwind: '$project' },
    {
      $project: {
        _id: 1,
        title: 1,
        status: 1,
        priority: 1,
        createdAt: 1,
        projectId: 1,
        projectName: '$project.name'
      }
    }
  ]).toArray();

  console.log('🔹 Step 6 — Final result (after $project reshape)');
  console.log(JSON.stringify(result, null, 2));
  console.log(`   (${result.length} task(s))\n`);

  // Verification: each task now has a projectName
  result.forEach((doc, i) => {
    const check = doc.projectName ? '✅' : '❌';
    console.log(`   ${check} #${i + 1} "${doc.title}" → project: "${doc.projectName}" (${doc.status}, priority ${doc.priority})`);
  });

  console.log('='.repeat(60) + '\n');
  return result;
}

// =============================================================================
//  EXPORTS — do not edit
// =============================================================================
module.exports = {
  signupUser,
  loginFindUser,
  listUserProjects,
  createProject,
  archiveProject,
  listProjectTasks,
  createTask,
  updateTaskStatus,
  addTaskTag,
  removeTaskTag,
  toggleSubtask,
  deleteTask,
  searchNotes,
  projectTaskSummary,
  recentActivityFeed
};