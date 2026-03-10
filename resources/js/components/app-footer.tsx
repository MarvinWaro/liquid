export function AppFooter() {
    return (
        <footer className="w-full py-8 px-12 text-center text-xs text-muted-foreground/50 mt-auto">
            <p>© {new Date().getFullYear()} Commission on Higher Education. All rights reserved.</p>
            <p className="mt-0.5">Liquidation Management System — UniFAST</p>
        </footer>
    );
}
