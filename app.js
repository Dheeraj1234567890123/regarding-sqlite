// app.js
// Import required modules
// Import required modules
// app.js

// app.js

// Import necessary packages
const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const databasePath = path.join(__dirname, 'twitterClone.db')

const app = express()

app.use(express.json())

let database = null

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const validatePassword = password => {
  return password.length > 5
}

const convertEachUserIntoResponseObject = dbObject => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
    response.send('Invalid Request')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        console.log('ttttttttt')
        console.log(payload)
        request.payload = payload
        next()
      }
    })
  }
}

app.post('/register/', async (request, response) => {
  console.log('hi')
  console.log(request.body)
  console.log('helloee')
  const {username, name, password, gender} = request.body

  console.log('hello1')
  console.log(request.body)
  const hashedPassword = await bcrypt.hash(password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username,  password,name, gender)
     VALUES
      (
       '${username}',
       
       '${hashedPassword}',
       '${name}',
       '${gender}'
         
      );`
    if (validatePassword(password)) {
      await database.run(createUserQuery)
      response.send('User created successfully')
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)

  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 3
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const username = request.payload.username
  const getUsersQuery = `
    SELECT users.username, tweets.tweet, tweets.date_time
    FROM Follower
    INNER JOIN users ON Follower.following_user_id = users.user_id
    INNER JOIN tweets ON Follower.following_user_id = tweets.user_id
    WHERE users.username = ${username} 
    ORDER BY tweets.date_time DESC
    LIMIT 4;
  `
  const usersArray = await database.all(getUsersQuery)
  response.send(
    usersArray.map(eachUser => convertEachUserIntoResponseObject(eachUser)),
  )
})

//API 4

const convertDBToResponse = dbObject => {
  return {
    name: dbObject.name,
  }
}

app.get('/user/following/', authenticateToken, async (request, response) => {
  const getUsersQuery = `
    SELECT DISTINCT users.name
    FROM Follower
    INNER JOIN users ON Follower.following_user_id = users.user_id;
  `
  const usersArray = await database.all(getUsersQuery)
  const followingList = usersArray.map(row => ({
    name: row.name,
  }))

  response.json(followingList)
})

//API 5

app.get('/user/followers/', authenticateToken, async (request, response) => {
  const getUsersQuery = `SELECT u.name
FROM user u
JOIN follower f ON u.user_id = f.follower_user_id`
  const usersArray = await database.all(getUsersQuery)
  response.send(usersArray.map(eachName => convertDBToResponse(eachName)))
})

//API 9

app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const username = request.payload.username

  // Check if the user ID is provided

  // Query to fetch all tweets of the user
  const query = `
    SELECT tweet,
           (SELECT COUNT(*) FROM Like WHERE tweet_id = tweets.tweet_id) AS likes,
           (SELECT COUNT(*) FROM Reply WHERE tweet_id = tweets.tweet_id) AS replies,
           date_time AS dateTime
    FROM tweets
    WHERE user_id = ${userId};
  `

  // Execute the query
  database.all(query, [userId], (err, rows) => {
    if (err) {
      console.error(err.message)
      res.status(500).json({error: 'Internal Server Error'})
      return
    }

    // Format the response
    const tweets = rows.map(row => ({
      tweet: row.tweet,
      likes: row.likes,
      replies: row.replies,
      dateTime: row.dateTime,
    }))
    response.json(tweets)
  })
})
//API 10

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body
  const postTweetQuery = `INSERT INTO tweet (tweet) 
  VALUES ("${tweet}")`
  await database.run(postTweetQuery)
  response.send('Created a Tweet')
})

//API 11

app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const deleteTweetQuery = `DELETE FROM  tweet WHERE tweet_id=${tweetId}`
    const deleted = await database.run(deleteTweetQuery)

    response.send('Tweet Removed')
  },
)

//API 6

app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const getQuery = `SELECT 
    t.tweet_id,
    t.user_id,
    t.tweet,
    COUNT(l.like_id) AS likes_count,
    COUNT(r.reply_id) AS replies_count,
    t.date_time
FROM 
    tweet AS t
LEFT JOIN 
    like AS l ON t.tweet_id = l.tweet_id
LEFT JOIN 
    reply AS r ON t.tweet_id = r.tweet_id
JOIN 
    follower AS f ON t.user_id = f.following_user_id
WHERE 
    t.tweet_id=${tweetId}
GROUP BY 
    t.tweet_id
ORDER BY 
    t.date_time DESC
LIMIT 4;
`
  const queryResult = await database.get(getQuery)
  const result = {
    tweet: queryResult.tweet,
    likes: queryResult.likes_count,
    replies: queryResult.replies_count,
    dateTime: queryResult.date_time,
  }

  response.send(result)
})

//API 7

app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const getTweetLikesQuery = `
    SELECT user.username as likes
  FROM user 
  JOIN like  ON user.user_id = like.user_id
  WHERE like.tweet_id = ${tweetId};
  `
    const queryResult = await database.get(getTweetLikesQuery)
  },
)

app.get(
  '/tweets/:tweetId/replies',
  authenticateToken,
  async (request, response) => {},
)

module.exports = app
