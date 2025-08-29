# Overview

Circuit Simulator Pro is a full-stack web application for designing and simulating electronic circuits. The application provides an interactive canvas for placing electronic components (resistors, capacitors, LEDs, transistors, ICs), connecting them with wires, and running real-time simulations to analyze voltage, current, and other electrical properties. It includes measurement tools like a digital multimeter and oscilloscope for circuit analysis.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built using **React 18** with TypeScript, utilizing a modern component-based architecture. Key architectural decisions include:

- **Component Library**: Implements shadcn/ui components based on Radix UI primitives for consistent, accessible UI elements
- **Styling**: Uses Tailwind CSS with custom CSS variables for theming, supporting both light and dark modes
- **State Management**: Zustand for client-side state management, providing a simple and performant store for circuit data, simulation state, and UI interactions
- **Routing**: Wouter for lightweight client-side routing
- **Canvas Rendering**: HTML5 Canvas API for real-time circuit drawing and interaction
- **Build Tool**: Vite for fast development and optimized builds with Hot Module Replacement (HMR)

The architecture separates concerns into distinct layers: UI components, business logic (stores), utilities, and type definitions. This modular approach enables easy testing and maintenance.

## Backend Architecture
The backend follows a **REST API** pattern using Express.js with TypeScript:

- **Framework**: Express.js with middleware for JSON parsing, URL encoding, and request logging
- **Data Validation**: Zod schemas for type-safe request/response validation
- **Storage Layer**: Abstracted storage interface currently implemented with in-memory storage, designed to easily swap to database persistence
- **Error Handling**: Centralized error handling middleware with proper HTTP status codes
- **Development**: Integrated with Vite for seamless full-stack development experience

The backend exposes CRUD operations for circuits through RESTful endpoints, with proper error handling and validation.

## Data Storage Solutions
The application uses a **hybrid approach** for data persistence:

- **Database**: PostgreSQL configured with Drizzle ORM for type-safe database operations
- **Schema**: Circuit data stored as JSONB for flexibility, with structured metadata (name, description, timestamps)
- **Migrations**: Database schema versioning with Drizzle Kit for safe schema evolution
- **Current Implementation**: In-memory storage with interface abstraction to enable easy migration to database persistence

The choice of JSONB for circuit data allows for flexible circuit topology storage while maintaining SQL query capabilities for metadata.

## External Dependencies

- **Database Provider**: Neon Database (PostgreSQL-compatible) for cloud-hosted database services
- **UI Components**: Radix UI primitives for accessible, unstyled UI components
- **State Management**: Zustand for lightweight, performant client state
- **Validation**: Zod for runtime type validation and schema definition
- **Canvas Manipulation**: HTML5 Canvas API for circuit drawing and real-time interaction
- **HTTP Client**: React Query (TanStack Query) for server state management and caching
- **Build Tools**: Vite for frontend bundling, esbuild for backend bundling
- **Styling**: Tailwind CSS for utility-first styling with custom design system
- **Icons**: Lucide React for consistent iconography
- **Development**: Replit-specific plugins for enhanced development experience in Replit environment

The application is designed to run efficiently in cloud environments with proper error boundaries, loading states, and responsive design for various screen sizes.