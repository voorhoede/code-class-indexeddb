# Code Class: IndexedDB

This code class is based heavily on Google’s excellent article [Working with IndexedDB](https://developers.google.com/web/ilt/pwa/working-with-indexeddb).

The class is a matter of reading this document, while having your Google Chrome inspector open and copying, pasting and modifying the code that I typed for you.

## Usage

Clone this repo, then

```bash
$ npm i
$ npm start
```

Open http://localhost:5000 in your browser.

## Introduction

Here are some quotes from MDN & Google:

> IndexedDB is a low-level API for client-side storage of significant amounts of structured data, including files/blobs. This API uses indexes to enable high-performance searches of this data.

...and also: 

> IndexedDB is a way for you to persistently store data inside a user's browser. Because it lets you create web applications with rich query abilities regardless of network availability, these applications can work both online and offline. 

Lastly,

> Each IndexedDB database is unique to an origin (typically, this is the site domain or subdomain), meaning it cannot access or be accessed by any other origin.

## Why IndexedDB

- Feature rich
- No (documented) storage limit 🤘 ([well...](https://www.raymondcamden.com/2015/04/17/indexeddb-and-limits))
- Web Worker-enabled (meaning: can be used in Service Worker)

But: this is not Mongo nor MySQL; it doesn’t do relationships out of the box, for instance, and complex querying can get... complex

## Why not local- or session storage?

- Size limits
- Persistence
- IndexedDB is more than a key-value store

## Uses

- Cache reference for Service Worker
- Persist data locally, background sync w/server
- Local cache for often accessed data that doesn’t change

## But... cache storage

Yes, IndexedDB has lost some of its usefulness in working offline to the cache storage that Service Workers use, where full requests can be stored & accessed via SW.

# Terms

**Database**: A database; you can have as many as you want. It is only accessible on 'this' origin; it uses the `same-origin` policy to figure out what that is.

**Object Store**: Bucket of records of a certain 'model', a 'table' in relational databases (example: `actors`). Data in an object store doesn’t have strict typing: an Actor’s age can be a string `"57"` in one record, a number `57` in the next, for example.

**Index**: Key-value store that lets an index point to records in some object store. This index is then used to query, sort etc.

**Transaction**: a group of actions done on the database; if any action fails, the whole transaction fails and the database isn’t changed. Used to ensure data integrity. All operations in IndexedDB must be part of a transaction.

**Cursor**: a mechanism to iterate over records in an object store.

# API

IndexedDB has an event-based API:

```javascript
let dbOpenRequest = window.indexedDB.open('movies', 1)
dbOpenRequest.onerror = event => alert('😱')
dbOpenRequest.onsuccess = event => alert('😎')
dbOpenRequest.onupgradeneeded = event => alert('🤔')
```

Event handlers & callbacks make development hard, especially if you want to cover all errors. Luckily, Jake Archibald wrote a [Promises-based wrapper called ‘idb’](https://github.com/jakearchibald/idb) that is included on this page: you have `idb` on the global scope.

```javascript
idb.open('movies', 1)
	.then(db => alert('😎'))
	.catch(() => alert('😱'))
```

There are (many) other wrappers, a notorious one being [PouchDB](https://pouchdb.com/) that comes with semi-built-in syncing to CouchDB 👏

# Creating a database, object store & adding a record

Let’s create a database, an object store & add an object. Use / paste the following code in your inspector.

```javascript
idb.open('movies', 1, upgradeDb => {
	upgradeDb.createObjectStore('actors', {
		autoIncrement: true
	})
}).then(db => {
	let transaction = db.transaction('actors', 'readwrite')
	let store = transaction.objectStore('actors')
	let actor = {
		name: 'Bill Murray',
		level: 9001
	}
	store.add(actor)
	return transaction.complete
}).catch(console.error)
```

Btw, you can chain all these actions together, which looks cool and is what we’ll do from now on:

```javascript
...then(db => db.transaction('actors', 'readwrite')
	.objectStore('actors')
	.add({
		name: 'Bill Murray',
		level: 9001
	}).complete
)
```

## Version

The version (`1`, in the snippet above) is used in combination with `upgradeDb` to run updates & migrations for the database. You can omit the version number; the current implementation of the database in your client will simply be 'current'. Note that ‘versioning’ in IndexedDB is not comparable to versioning for software; you can’t tell the client to use an old version, for instance.

## UpgradeDb

This is the promisified implementation of:

```javascript
dbOpenRequest.onupgradeneeded = event => // ...
```

This is where we define the structure of the database, and execute (structure) updates when needed. The `version` parameter can be used to discern what parts of the database need to be upgraded. In old times, this would be a `SQL` migration script of some sort. More on this later.

## Transaction

A transaction is aimed at the object stores you want to interact with. If there are multiple stores you need to manipulate, use an array:

```javascript
let transaction = db.transaction(['actors', 'directors'])
```

To access all stores:

```javascript
let transaction = db.transaction(db.objectStoreNames)
```

The default `mode` of a transaction is `'readonly'`.

```javascript
let transaction = db.transaction('actors', 'readonly')
```

## KeyPath & autoIncrement

- The 'uniqueness' of a record can be set with either an auto increment...
- ...or a property that is already available in the object store:

```javascript
upgradeDb.createObjectStore('employees', { 
	keyPath: 'employeeEmail' 
})
```

The `autoIncrement`, as used earlier, is a special key that is stored in the object store to be able to find & modify the record. We’ll work with this later.

```javascript
upgradeDb.createObjectStore('employees', { 
	autoIncrement: true
})
```

The auto increment can also be set to a specific property:

```javascript
upgradeDb.createObjectStore('employees', { 
	keyPath: 'id',
	autoIncrement: true
})
```

This will automatically add the property `id` to your object:

```javascript
{
	id: 1,
	level: 9001,
	name: 'Bill Murray'
}
```

## Transaction.complete

When the transaction was carried out, `transaction.complete` will resolve, and reject if it failed. In my experience, this is hardly ever useful 🙌 and in some cases, will return `undefined` whether something happened or not.

## Exercise 1

- Play with adding other actors
- Find your added stuff in `Application > IndexedDB`
- Now, delete & rebuild the database and change `autoIncrement` into a `keyPath` with the actor’s name as key. Try to add the same actor twice.

# Reading, updating & destroying

Reading, updating & destroying records needs the same ‘boilerplate’ as creating records.

## Getting a record

This is fairly straightforward:

```javascript
idb.open('movies')
	.then(db => db.transaction('actors')
		.objectStore('actors')
		.get(1)
	)
	.then(console.log)
```

Here, the `1` is the value of the `autoIncrement` we set earlier. If you’d have specified a `keyPath`, or a 'named' `autoIncrement`, you would query on that value. Example:

```javascript
...get('unique_email@example.com')
```

## Updating records

Updates are easy, too. The changed object is `put` into the objectStore, either using the `keyPath` you defined as a property of the changed object, or the `autoIncrement` value as a parameter of the `put` method:

Using a property (defined `keyPath`)...

```javascript
...put({ id: 1, name: 'William James Murray' })
```

...or using the `autoIncrement` value:

```javascript
...put({ name: 'William James Murray' }, 1)
```

Also, make sure to set the `transaction` to `'readwrite'`. Since the default is `'readonly'`, the IndexedDB API will throw an error if you try to `put` in your transaction while in readonly mode:

```javascript
idb.open('movies')
	.then(db => db.transaction('actors', 'readwrite')
		.objectStore('actors')
		.put({
			level: 9001,
			name: 'William James Murray'
		}, 1)
		.complete
	)
```

## Deleting records

Deleting is a mix of `get` and `put`: again, you can either use a `keyPath` or `autoIncrement` value. The transaction should be `readwrite`. Although it is good practice to return `.complete` at the end of the chain, the promise will resolve with `undefined` whether it was deleted or not 🤔

```javascript
idb.open('movies')
	.then(db => db.transaction('actors', 'readwrite')
		.objectStore('actors')
		.delete(1)
		.complete
	)
```

## Get all records

Getting all records with `getAll` returns an array of objects.

```javascript
idb.open('movies')
	.then(db => db.transaction('actors')
		.objectStore('actors')
		.getAll()
	).then(console.log)
```

These ones were easy to get, right?

## Exercise 2

- Play with `put`, `delete` and `getAll`. 
- Make sure you use either a defined `keyPath` or an `autoIncrement` value. If you mix up your identifiers, IndexedDB will hardly notify you. In the case of `put`, it will simply add a new record.

# Cursors

Bulk actions, like updating every record in an object store, is done with a 'cursor'. Cursors are a common, if not often used, mechanism to iterate through database records and exist in relational as well as document databases (like `MySQL` and `Mongo` respectively). There is some weird stuff going on:

```javascript
idb.open('movies')
	.then(db => db.transaction('actors')
		.objectStore('actors')
		.openCursor())
	.then(logItems = cursor => {
		if (!cursor) return
		console.log(cursor.value)
		return cursor.continue().then(logItems)
	})
```

## OpenCursor

Returns a promise containing the `cursor`, which in turn contains the record itself, via `cursor.value`. Using `cursor.continue()`, the cursor moves to the next record.

## LogItems

We use this named recursive function (it’s _our_ naming) to be able to keep looping through the records. This could have been written as:

```javascript
function logItemAndMoveOn(cursor) {
	if (!cursor) return
	console.log(cursor.value)
	return cursor
		.continue()
		.then(logItemAndMoveOn)
}

idb.open('movies')
	.then(db => db.transaction('actors')
		.objectStore('actors')
		.openCursor())
	.then(logItemAndMoveOn)
```

The `if (!cursor) return` breaks the loop. This is an old fashioned recursive function; it might seem odd, but only because it’s not often needed nor used when adding classes to DOM elements ;)

## Update & delete with the cursor

Reading with the cursor is not very impressive, but the cursor also has `update` and `delete` methods. 

```javascript
idb.open('movies')
	.then(db => db.transaction('actors', 'readwrite')
		.objectStore('actors')
		.openCursor())
	.then(doStuffWithItem = cursor => {
		if (!cursor) return
		if (cursor.value.level < 9001) {
			cursor.delete()
		} else {
			let record = cursor.value
			record.awesome = true
			cursor.update(record)
		}
		return cursor
			.continue()
			.then(doStuffWithItem)
})
```

There are some variants to how a cursor behaves, iterating from last to first, for instance:

```javascript
...openCursor(null, 'prev')
```

The default behaviour is indeed `openCursor(null, 'next')`.

Note: the `null` value is to satisfy the `range` parameter. This isn’t covered in this class: it basically comes down to setting an `IDBKeyRange` ([MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange) so that you have control over what records to traverse instead of 'all of them'.

## Exercise 3

- Use a cursor to traverse over the `actors` store and `console.log` each record
- What happen if you use `prev`?
- Update a record, or all of them, to your liking!

# UpgradeDB & versioning

In the first step, we set the version of our database to `1`. Let’s set it to `2` now:

```javascript
idb.open('movies', 2, upgradeDb => {
	// ...
})
```

In the inspector, when hovering over the database, you can see that the version is now '2'. This is useful how?

Well, by knowing the version we can upgrade our database during instantiation. There is a property `oldVersion` available on the `upgradeDb` promise that we can use to execute tasks during the upgrade cycle:

```javascript
idb.open('movies', 2, upgradeDb => {
	switch (upgradeDb.oldVersion) {
		case 0: // if database didn’t exist yet
			upgradeDb.createObjectStore('actors', {
				autoIncrement: true
			})
		case 1:
			upgradeDb.createObjectStore('directors', {
				autoIncrement: true
			})
	}
})
```

Note that since we don’t use a `break` between cases, all cases will be ’played out’. This is how every user, regardless of their client’s previous database version, will be up to date when the database is opened.

We’ll use this awesomeness in the last bit of our class:

# Indexes

This is where your database actually becomes useful. Let’s update the database with an index on `level`:

```javascript
idb.open('movies', 3, upgradeDb => {
	switch (upgradeDb.oldVersion) {
		case 0: // if database didn’t exist yet
			upgradeDb.createObjectStore('actors', {
				autoIncrement: true
			})
		case 1:
			upgradeDb.createObjectStore('directors', {
				autoIncrement: true
			})
		case 2:
			upgradeDb.transaction
				.objectStore('actors')
				.createIndex('level', 'level')
	}
})
```

Note that to create an index on a store, we don’t have to open a transaction for that store: we simply use dot notation to select an `objectStore` and call `createIndex` there.

Let’s add a record:

```javascript
idb.open('movies')
	.then(db => db.transaction('actors', 'readwrite')
		.objectStore('actors')
		.add({
			name: 'Dan Aykroyd',
			level: 9000
		})
		.complete
	)
```

Now, if we `getAll` records from this specific `index`, we’ll see that the order is based on the value of that index:

```javascript
idb.open('movies')
	.then(db => db.transaction('actors')
		.objectStore('actors')
		.index('level')
		.getAll()
	).then(console.log)
```

That is the best thing ever.

## Exercise 4

- Use the `upgradeDb` script from above to add an index to your database. If your database is messed up from all the previous exercises, clear your cache via `Application > Clear Storage`.
- Add some actors with different levels (hint: women can be actors, too)
- Use `getAll` on the store itself as well as on the index to see how it differs.

# That’s IT

Use [MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) to find out more, and [Google’s Developer docs](https://developers.google.com/web/ilt/pwa/working-with-indexeddb) to understand everything worse/better.

👋
