# TurfOp - A Modern Project Management Tool

TurfOp is a powerful, Jira-style project management application built with a modern frontend stack. It provides a comprehensive suite of tools for tracking issues, managing sprints, and visualizing project progress, all with a polished and responsive user interface.

## Features

- **Multiple Views:** Seamlessly switch between a high-level Dashboard, a drag-and-drop Kanban Board, and a detailed List view.
- **Issue Tracking:** Create, update, and manage issues with statuses, priorities, assignees, due dates, and labels.
- **Sprints & Epics:** Organize work into sprints and group related issues into epics for better long-term planning.
- **Advanced Filtering:** Quickly find what you're looking for with powerful filters for status, assignee, priority, and due date.
- **Dark Mode:** A beautifully implemented dark mode for comfortable use in any lighting condition.
- **Persistence:** All your issues, sprints, and epics are saved to local storage, so your data is preserved between sessions.
- **Activity History:** Track all changes and comments on an issue with a detailed activity log.

## Tech Stack

- **Frontend:** React + Vite
- **UI:** Tailwind CSS with shadcn/ui components
- **Charting:** Recharts
- **Drag & Drop:** dnd-kit

## Running Locally

To run the application locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd turfop
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:5173`.

## Git Remote Setup

To push this project to your own GitHub or GitLab repository, run:

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

Replace `<your-repo-url>` with the actual remote URL.
