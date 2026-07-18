package pkg

import "fmt"

// Server is a trivial exported type used by the fixture.
type Server struct {
	Name string
}

func (s *Server) Start() string {
	return fmt.Sprintf("starting %s", s.Name)
}

func NewServer(name string) *Server {
	return &Server{Name: name}
}
