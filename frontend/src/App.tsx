import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  TextField,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Divider,
  Collapse,
  Alert,
  Snackbar
} from "@mui/material";

interface Book {
  book_id: string;
  title: string;
  authors: string;
  languages: string[];
  analysis?: {
    summary: string;
    themes: string[];
    target_audience: string;
    writing_style: string;
    key_insights: string[];
    sentiment_analysis: string;
  };
}

const API_HOST_URL = import.meta.env.VITE_API_HOST_URL || "http://localhost:8000";

function App() {
  const [bookId, setBookId] = useState<string>("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBook, setLoadingBook] = useState<boolean>(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await axios.get(`${API_HOST_URL}/books/`);
        setBooks(response.data.books);
      } catch (error) {
        console.error("Error fetching books:", error);
      }
    };
    fetchBooks();
  }, []);

  const fetchBook = async () => {
    if (!bookId) return;
    if (books.some(book => book.book_id == bookId)) {
      setAlertMessage("This book is already in the list!");
      return;
    }
    setLoadingBook(true);
    try {
      const response = await axios.get(`${API_HOST_URL}/books/${bookId}`);
      if (response.status === 200) {
        setBooks((prev) => [...prev, response.data]);
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        setAlertMessage("Book not found. Please check the Book ID.");
      } else {
        console.error("Error fetching book:", error);
      }
    }
    setLoadingBook(false);
  };

  const handleCloseAlert = () => setAlertMessage(null);

  const analyzeBook = async (book_id: string) => {
    setLoadingAnalysis(book_id);
    try {
      const response = await axios.get(`${API_HOST_URL}/books/${book_id}/analyze`);
      if (response.status === 200) {
        setBooks((prev) => prev.map(book => book.book_id === book_id ? { ...book, analysis: response.data.analysis } : book));
      }
    } catch (error) {
      console.error("Error analyzing book:", error);
    }
    setLoadingAnalysis(null);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, backgroundColor: 'white', padding: 3, borderRadius: 2 }}>
      <Typography variant="h4" gutterBottom>
        Project Gutenberg
      </Typography>
      <TextField
        label="Enter Book ID"
        variant="outlined"
        fullWidth
        value={bookId}
        onChange={(e) => setBookId(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Snackbar
        open={!!alertMessage}
        autoHideDuration={3000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={handleCloseAlert} severity="warning" sx={{ width: "100%" }}>
          {alertMessage}
        </Alert>
      </Snackbar>
      <Button variant="contained" color="primary" onClick={fetchBook} disabled={loadingBook}>
        {loadingBook ? <CircularProgress size={24} /> : "Fetch Book"}
      </Button>
      {books.length != 0 && <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Book ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Authors</TableCell>
              <TableCell>Languages</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {books.map((book, index) => (
              <React.Fragment key={index}>
                <TableRow>
                  <TableCell>{book.book_id}</TableCell>
                  <TableCell>{book.title}</TableCell>
                  <TableCell>{book.authors}</TableCell>
                  <TableCell>{book.languages}</TableCell>
                  <TableCell>
                    {!book.analysis ? (
                      <Button variant="outlined" onClick={() => analyzeBook(book.book_id)} disabled={loadingAnalysis === book.book_id}>
                        {loadingAnalysis === book.book_id ? <CircularProgress size={24} /> : "Analyze"}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: "80px", padding: "4px 8px" }}
                        onClick={() => setExpandedBook(expandedBook === book.book_id ? null : book.book_id)}
                      >
                        {expandedBook === book.book_id ? "Hide" : "Show"} Analysis
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={5} sx={{ padding: 0, borderBottom: "none" }}>
                    <Collapse in={expandedBook === book.book_id} timeout="auto" unmountOnExit>
                      <Card sx={{ p: 2, boxShadow: "none" }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Summary
                          </Typography>
                          <Typography>{books.find(book => book.book_id === expandedBook)?.analysis?.summary}</Typography>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Themes
                          </Typography>
                          {books.find(book => book.book_id === expandedBook)?.analysis?.themes.map((theme, index) => (
                            <Chip key={index} label={theme} sx={{ mr: 1, mb: 1 }} />
                          ))}
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Target Audience
                          </Typography>
                          <Typography>{books.find(book => book.book_id === expandedBook)?.analysis?.target_audience}</Typography>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Writing Style
                          </Typography>
                          <Typography>{books.find(book => book.book_id === expandedBook)?.analysis?.writing_style}</Typography>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Key Insights
                          </Typography>
                          {books.find(book => book.book_id === expandedBook)?.analysis?.key_insights.map((insight, index) => (
                            <Typography key={index}>• {insight}</Typography>
                          ))}
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Sentiment Analysis
                          </Typography>
                          <Typography>{books.find(book => book.book_id === expandedBook)?.analysis?.sentiment_analysis}</Typography>
                        </CardContent>
                      </Card>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      }
    </Container>
  );
}

export default App;