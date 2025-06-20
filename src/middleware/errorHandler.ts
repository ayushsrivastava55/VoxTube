import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/index.js';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  const apiError: ApiError = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  };

  res.status(500).json(apiError);
}

export function notFoundHandler(req: Request, res: Response): void {
  const apiError: ApiError = {
    error: 'Route not found',
    code: 'NOT_FOUND'
  };

  res.status(404).json(apiError);
}