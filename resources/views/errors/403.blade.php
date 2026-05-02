@extends('errors.minimal')

@section('code', '403')
@section('title', 'Forbidden')
@section('message', $exception->getMessage() ?: 'You don’t have permission to access this resource.')
