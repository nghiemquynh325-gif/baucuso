import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border-2 border-red-100 max-w-md w-full text-center space-y-6">
                        <div className="inline-flex items-center justify-center size-20 bg-red-100 text-red-600 rounded-3xl mb-4">
                            <span className="material-symbols-outlined text-5xl">report</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase">Hệ thống gặp sự cố</h1>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed">
                            Xin lỗi, một lỗi không mong muốn đã xảy ra. Vui lòng thử tải lại trang hoặc liên hệ quản trị viên.
                        </p>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chi tiết lỗi:</p>
                            <p className="text-[11px] font-mono text-admin-red break-words">{this.state.error?.message}</p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-primary/20"
                        >
                            Tải lại trang ứng dụng
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
