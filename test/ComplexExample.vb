Option Explicit On
Option Strict On
Option Infer Off

Imports System
Imports System.Collections.Generic
Imports System.Linq
Imports System.Text

''' <summary>
''' A complex example class demonstrating various VB.NET features
''' </summary>
Public Class ComplexCalculator
    Private ReadOnly _values As New List(Of Double)
    Private _lastOperation As String
    Private Shared _instanceCount As Integer

    ''' <summary>
    ''' Event that fires when a calculation is completed
    ''' </summary>
    Public Event CalculationCompleted(sender As Object, result As Double)

    ''' <summary>
    ''' Initializes a new instance of the ComplexCalculator class
    ''' </summary>
    Public Sub New()
        _instanceCount += 1
        _lastOperation = "None"
    End Sub

    ''' <summary>
    ''' Adds a value to the calculation list
    ''' </summary>
    Public Function AddValue(value As Double) As ComplexCalculator
        _values.Add(value)
        Return Me
    End Function

    ''' <summary>
    ''' Calculates the sum of all values using LINQ
    ''' </summary>
    Public Function CalculateSum() As Double
        If _values.Count = 0 Then
            Throw New InvalidOperationException("No values to sum")
        End If

        _lastOperation = "Sum"
        Dim result = _values.Sum()
        RaiseEvent CalculationCompleted(Me, result)
        Return result
    End Function

    ''' <summary>
    ''' Calculates the average with custom logic
    ''' </summary>
    Public Function CalculateAverage() As Double
        Select Case _values.Count
            Case 0
                Throw New InvalidOperationException("No values to average")
            Case 1
                Return _values(0)
            Case Else
                _lastOperation = "Average"
                Dim result = _values.Average()
                RaiseEvent CalculationCompleted(Me, result)
                Return result
        End Select
    End Function

    ''' <summary>
    ''' Demonstrates structure usage
    ''' </summary>
    Public Structure CalculationResult
        Public Property Operation As String
        Public Property Value As Double
        Public Property Timestamp As DateTime

        Public Function Format() As String
            Return $"{Operation}: {Value} at {Timestamp}"
        End Function
    End Structure

    ''' <summary>
    ''' Gets the last calculation result
    ''' </summary>
    Public Function GetLastResult() As CalculationResult
        Return New CalculationResult With {
            .Operation = _lastOperation,
            .Value = If(_values.Any(), _values.Last(), 0),
            .Timestamp = DateTime.Now
        }
    End Function

    ''' <summary>
    ''' A generic method example
    ''' </summary>
    Public Function ProcessValues(Of T)(processor As Func(Of Double, T)) As IEnumerable(Of T)
        Return _values.Select(processor)
    End Function

    ''' <summary>
    ''' Demonstrates interface implementation
    ''' </summary>
    Private Interface IValueProcessor
        Function Process(value As Double) As Double
    End Interface

    ''' <summary>
    ''' An example nested class implementing IValueProcessor
    ''' </summary>
    Private Class SquareProcessor
        Implements IValueProcessor

        Public Function Process(value As Double) As Double Implements IValueProcessor.Process
            Return value * value
        End Function
    End Class

    ''' <summary>
    ''' Property example with backing field
    ''' </summary>
    Private _customMultiplier As Double = 1.0
    Public Property CustomMultiplier As Double
        Get
            Return _customMultiplier
        End Get
        Set(value As Double)
            If value = 0 Then
                Throw New ArgumentException("Multiplier cannot be zero")
            End If
            _customMultiplier = value
        End Set
    End Property

    ''' <summary>
    ''' Static property example
    ''' </summary>
    Public Shared ReadOnly Property InstanceCount As Integer
        Get
            Return _instanceCount
        End Get
    End Property
End Class