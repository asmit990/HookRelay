import express from "express"


const app = express()
const PORT =  3001     

app.use(express.json())




app.get("/health", (req, res) => {
    res.send("this is healthy")
})


app.listen(PORT, () => {
  console.log(`the is port is http://localhost:${PORT}`)
})

